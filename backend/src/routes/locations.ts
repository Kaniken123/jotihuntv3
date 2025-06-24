import express from 'express';
import { db } from '../utils/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.get('/settings', authenticateToken, async (req, res) => {
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

router.post('/settings', authenticateToken, async (req, res) => {
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

router.post('/update', authenticateToken, async (req, res) => {
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
        io.to(`team-${teamMember.team_id}`).emit('team-location-update', locationUpdate);
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

router.get('/latest', authenticateToken, async (req, res) => {
  try {
    const { team_only } = req.query;
    
    let userIds = [];
    
    if (team_only === 'true') {
      const teamMembers = await db('team_members')
        .join('team_members as tm2', 'team_members.team_id', 'tm2.team_id')
        .where('team_members.user_id', req.user!.id)
        .select('tm2.user_id');
      
      userIds = teamMembers.map(member => member.user_id);
    }

    let query = db('user_locations')
      .select('user_locations.*', 'users.username', 'users.first_name', 'users.last_name')
      .join('users', 'user_locations.user_id', 'users.id')
      .join('location_settings', 'user_locations.user_id', 'location_settings.user_id')
      .where('location_settings.location_sharing_enabled', true)
      .where('location_settings.privacy_mode', false)
      .whereIn('user_locations.user_id', function() {
        this.select('ul2.user_id')
          .from('user_locations as ul2')
          .whereRaw('ul2.user_id = user_locations.user_id')
          .orderBy('ul2.recorded_at', 'desc')
          .limit(1);
      })
      .orderBy('user_locations.recorded_at', 'desc');

    if (userIds.length > 0) {
      query = query.whereIn('user_locations.user_id', userIds);
    }

    const locations = await query;
    res.json(locations);
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
    if (req.user!.id !== parseInt(user_id) && req.user!.role !== 'admin') {
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

    if (req.user!.id !== parseInt(user_id) && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db('user_locations').where('user_id', user_id).del();
    res.json({ message: 'Location history deleted successfully' });
  } catch (error) {
    console.error('Delete location history error:', error);
    res.status(500).json({ error: 'Failed to delete location history' });
  }
});

export default router;