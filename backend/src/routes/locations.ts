import express from 'express';
import { db } from '../utils/database';
import { authenticateToken, isAdmin, enforceTenantIsolation } from '../middleware/auth';

const router = express.Router();

router.get('/settings', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    let settings = await db('location_settings')
      .where('user_id', req.user!.id)
      .first();

    if (!settings) {
      const [id] = await db('location_settings')
        .insert({
          user_id: req.user!.id,
          tracking_interval: 60,
          offline_threshold: 300,
          location_sharing_enabled: true,
          privacy_mode: false
        })
        .returning('id');

      settings = await db('location_settings').where('id', id).first();
    }

    res.json(settings);
  } catch (error) {
    console.error('Get location settings error:', error);
    res.status(500).json({ error: 'Failed to get location settings' });
  }
});

router.post('/settings', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const { tracking_interval, offline_threshold, location_sharing_enabled, privacy_mode } = req.body;

    const settings = await db('location_settings')
      .where('user_id', req.user!.id)
      .update({
        tracking_interval,
        offline_threshold,
        location_sharing_enabled,
        privacy_mode,
        updated_at: new Date()
      })
      .returning('*');

    res.json(settings[0]);
  } catch (error) {
    console.error('Update location settings error:', error);
    res.status(500).json({ error: 'Failed to update location settings' });
  }
});

router.post('/update', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    // Check location sharing settings
    const settings = await db('location_settings')
      .where('user_id', req.user!.id)
      .first();

    if (!settings?.location_sharing_enabled || settings?.privacy_mode) {
      return res.json({ message: 'Location sharing disabled' });
    }

    await db('user_locations').insert({
      user_id: req.user!.id,
      lat,
      lng,
      accuracy,
      recorded_at: new Date()
    });

    // Get user info for real-time update
    const user = await db('users')
      .select('id', 'username', 'first_name', 'last_name')
      .where('id', req.user!.id)
      .first();

    // Emit real-time location update
    const { getSocketIO } = require('../socketManager');
    try {
      const io = getSocketIO();
      const locationUpdate = {
        user_id: req.user!.id,
        username: user?.username,
        first_name: user?.first_name,
        last_name: user?.last_name,
        lat,
        lng,
        accuracy,
        recorded_at: new Date()
      };

      // Emit to all connected users (respecting privacy settings)
      io.emit('location-update', locationUpdate);

      // Also emit to user's team if they have one
      const teamMember = await db('team_members')
        .where('user_id', req.user!.id)
        .first();

      if (teamMember) {
        const tenantId = req.user!.current_tenant_id || req.user!.tenant_id;
        io.to(`tenant-${tenantId}-team-${teamMember.team_id}`).emit('team-location-update', locationUpdate);
      }
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
      // Continue without real-time update
    }

    // Clean up old locations (keep last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await db('user_locations')
      .where('user_id', req.user!.id)
      .where('recorded_at', '<', sevenDaysAgo)
      .del();

    res.json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

router.get('/latest', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=10'); // Short cache for location data
    
    const { team_only } = req.query;
    
    let userIds = [];
    
    if (team_only === 'true') {
      const teamMembers = await db('team_members')
        .join('team_members as tm2', 'team_members.team_id', 'tm2.team_id')
        .where('team_members.user_id', req.user!.id)
        .select('tm2.user_id');
      
      userIds = teamMembers.map(member => member.user_id);
    }

    // First, get the latest location ID for each user who has sharing enabled
    const latestLocationIds = await db('user_locations')
      .select('user_locations.id')
      .join('location_settings', 'user_locations.user_id', 'location_settings.user_id')
      .where('location_settings.location_sharing_enabled', true)
      .where('location_settings.privacy_mode', false)
      .whereIn('user_locations.id', function() {
        this.select(db.raw('MAX(ul2.id)'))
          .from('user_locations as ul2')
          .join('location_settings as ls2', 'ul2.user_id', 'ls2.user_id')
          .where('ls2.location_sharing_enabled', true)
          .where('ls2.privacy_mode', false)
          .groupBy('ul2.user_id');
      })
      .limit(100); // Reasonable limit

    const locationIds = latestLocationIds.map(row => row.id);

    if (locationIds.length === 0) {
      return res.json([]);
    }

    // Then get the full location data for those IDs
    let query = db('user_locations')
      .select('user_locations.*', 'users.username', 'users.first_name', 'users.last_name', 'teams.name as team_name', 'teams.area as team_area', 'team_members.role as team_role')
      .join('users', 'user_locations.user_id', 'users.id')
      .leftJoin('team_members', 'users.id', 'team_members.user_id')
      .leftJoin('teams', 'team_members.team_id', 'teams.id')
      .whereIn('user_locations.id', locationIds)
      .orderBy('user_locations.recorded_at', 'desc');

    if (userIds.length > 0) {
      query = query.whereIn('user_locations.user_id', userIds);
    }

    const locations = await query;

    // Add session status based on last activity (2 minutes threshold)
    const now = new Date();
    const locationsWithStatus = locations.map(location => {
      const lastActivity = new Date(location.recorded_at);
      const minutesSinceLastActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
      const isActiveSession = minutesSinceLastActivity <= 2;
      
      return {
        ...location,
        session_status: isActiveSession ? 'active' : 'inactive',
        minutes_since_last_activity: Math.round(minutesSinceLastActivity)
      };
    });

    res.json(locationsWithStatus);
  } catch (error) {
    console.error('Get latest locations error:', error);
    res.status(500).json({ error: 'Failed to get latest locations' });
  }
});

router.get('/history/:user_id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Check if user can access this data
    if (req.user!.id !== parseInt(user_id) && !isAdmin(req.user!)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const locations = await db('user_locations')
      .where('user_id', user_id)
      .orderBy('recorded_at', 'desc')
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json(locations);
  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({ error: 'Failed to get location history' });
  }
});

router.delete('/history/:user_id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;

    if (req.user!.id !== parseInt(user_id) && !isAdmin(req.user!)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db('user_locations').where('user_id', user_id).del();
    res.json({ message: 'Location history deleted successfully' });
  } catch (error) {
    console.error('Delete location history error:', error);
    res.status(500).json({ error: 'Failed to delete location history' });
  }
});

// Public route tracking - get user route for a specific time period (respects privacy)
router.get('/route/:user_id', authenticateToken, async (req, res) => {
  try {
    // Everyone can view routes, but only for users who have location sharing enabled or are fox team members

    const { user_id } = req.params;
    const { hours = 24, limit = 500 } = req.query;

    // Check if user has location sharing enabled
    const settings = await db('location_settings')
      .where('user_id', user_id)
      .first();

    // Allow access if user has location sharing enabled
    const canViewRoute = settings?.location_sharing_enabled && !settings?.privacy_mode;
    
    if (!canViewRoute) {
      return res.json({ 
        user: null,
        locations: [],
        statistics: {
          total_points: 0,
          total_distance_km: 0,
          max_speed_kmh: 0,
          time_period_hours: parseInt(hours as string),
          first_location: null,
          last_location: null
        },
        message: 'User has location sharing disabled or privacy mode enabled' 
      });
    }

    // Get user info
    const user = await db('users')
      .select('users.id', 'users.username', 'users.first_name', 'users.last_name')
      .leftJoin('team_members', 'users.id', 'team_members.user_id')
      .leftJoin('teams', 'team_members.team_id', 'teams.id')
      .select('teams.name as team_name', 'teams.area as team_area', 'team_members.role as team_role')
      .where('users.id', user_id)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get location history for specified time period
    const hoursAgo = new Date(Date.now() - parseInt(hours as string) * 60 * 60 * 1000);
    
    const locations = await db('user_locations')
      .where('user_id', user_id)
      .where('recorded_at', '>=', hoursAgo)
      .orderBy('recorded_at', 'asc')
      .limit(parseInt(limit as string));

    // Add movement statistics
    let totalDistance = 0;
    let maxSpeed = 0;
    
    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];
      
      // Calculate distance using Haversine formula
      const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      totalDistance += distance;
      
      // Calculate speed (km/h)
      const timeDiff = (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000 / 3600;
      if (timeDiff > 0) {
        const speed = distance / timeDiff;
        maxSpeed = Math.max(maxSpeed, speed);
      }
    }

    const route = {
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        team_name: user.team_name,
        team_area: user.team_area,
        team_role: user.team_role
      },
      locations,
      statistics: {
        total_points: locations.length,
        total_distance_km: Math.round(totalDistance * 100) / 100,
        max_speed_kmh: Math.round(maxSpeed * 100) / 100,
        time_period_hours: parseInt(hours as string),
        first_location: locations.length > 0 ? locations[0].recorded_at : null,
        last_location: locations.length > 0 ? locations[locations.length - 1].recorded_at : null
      }
    };

    res.json(route);
  } catch (error) {
    console.error('Get user route error:', error);
    res.status(500).json({ error: 'Failed to get user route' });
  }
});

// Helper function to calculate distance between two points in kilometers
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Get list of users for route selection (public access with privacy respect)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    // Everyone can view user list, but only those who have location sharing enabled

    const users = await db('users')
      .select('users.id', 'users.username', 'users.first_name', 'users.last_name')
      .leftJoin('team_members', 'users.id', 'team_members.user_id')
      .leftJoin('teams', 'team_members.team_id', 'teams.id')
      .leftJoin('location_settings', 'users.id', 'location_settings.user_id')
      .select(
        'teams.name as team_name', 
        'teams.area as team_area', 
        'team_members.role as team_role',
        'location_settings.location_sharing_enabled',
        'location_settings.privacy_mode'
      )
      .where('users.tenant_id', req.user!.current_tenant_id || req.user!.tenant_id)
      .where('location_settings.location_sharing_enabled', true)
      .where('location_settings.privacy_mode', false)
      .orderBy('users.username');

    // Get latest location for each user
    const usersWithLocations = await Promise.all(
      users.map(async (user) => {
        const latestLocation = await db('user_locations')
          .where('user_id', user.id)
          .orderBy('recorded_at', 'desc')
          .first();

        return {
          ...user,
          has_locations: !!latestLocation,
          last_seen: latestLocation?.recorded_at || null,
          can_view_route: user.location_sharing_enabled && !user.privacy_mode
        };
      })
    );

    res.json(usersWithLocations);
  } catch (error) {
    console.error('Get users for route tracking error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

export default router;