import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../utils/database';
import { authenticateToken, requireAdmin, isAdmin, enforceTenantIsolation } from '../middleware/auth';
import { getSocketIO } from '../socketManager';

const router = express.Router();

const uploadsDir = path.join(__dirname, '../../uploads/hunts');
fs.mkdirSync(uploadsDir, { recursive: true });

// Configure multer for hunt photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'hunt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG) are allowed'));
    }
  }
});

// Calculate points based on hunt location and team area
const calculateHuntPoints = (huntArea: string, teamArea?: string): number => {
  if (teamArea && huntArea === teamArea) {
    return 6; // Own area hunt
  }
  return 3; // Other area hunt
};

// Check hunt cooldown (prevent spam)
const HUNT_COOLDOWN_MINUTES = 15;

const checkHuntCooldown = async (userId: number, foxArea: string): Promise<boolean> => {
  const cooldownTime = new Date(Date.now() - HUNT_COOLDOWN_MINUTES * 60 * 1000);
  
  const recentHunt = await db('hunts')
    .where('hunter_user_id', userId)
    .where('fox_area', foxArea)
    .where('hunt_time', '>', cooldownTime)
    .first();
    
  return !recentHunt;
};

// Get user's hunts
router.get('/my-hunts', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const hunts = await db('hunts')
      .where('hunter_user_id', req.user!.id)
      .where('tenant_id', req.tenantId)
      .orderBy('hunt_time', 'desc');
      
    res.json(hunts);
  } catch (error) {
    console.error('Get user hunts error:', error);
    res.status(500).json({ error: 'Failed to get hunts' });
  }
});

// Get team's hunts
router.get('/team-hunts/:team_id', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const { team_id } = req.params;
    
    // Check if user is member of the team or admin
    const membership = await db('team_members')
      .where({ user_id: req.user!.id, team_id })
      .first();

    if (!membership && !isAdmin(req.user!)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const hunts = await db('hunts')
      .select('hunts.*', 'users.username', 'users.first_name', 'users.last_name')
      .join('users', 'hunts.hunter_user_id', 'users.id')
      .where('hunts.hunter_team_id', team_id)
      .where('hunts.tenant_id', req.tenantId)
      .orderBy('hunts.hunt_time', 'desc');
      
    res.json(hunts);
  } catch (error) {
    console.error('Get team hunts error:', error);
    res.status(500).json({ error: 'Failed to get team hunts' });
  }
});

// Submit a hunt
router.post('/submit', authenticateToken, enforceTenantIsolation, upload.single('photo'), async (req, res) => {
  try {
    const { fox_area, hunt_lat, hunt_lng } = req.body;

    if (!fox_area || !hunt_lat || !hunt_lng || !req.file) {
      return res.status(400).json({ 
        error: 'Fox area, coordinates, and photo are required' 
      });
    }

    // Get user's team (optional for hunt submission)
    const teamMembership = await db('team_members')
      .join('teams', 'team_members.team_id', 'teams.id')
      .select('teams.*', 'team_members.role')
      .where('team_members.user_id', req.user!.id)
      .first();

    // Allow hunts without team membership and without cooldown restrictions

    // Parse coordinates (allow default values for flexible submissions)
    const lat = parseFloat(hunt_lat) || 0;
    const lng = parseFloat(hunt_lng) || 0;

    // Check if fox area exists and is active
    const foxArea = await db('areas')
      .where({ name: fox_area, status: 'active' })
      .first();

    if (!foxArea) {
      return res.status(400).json({ error: 'Invalid or inactive fox area' });
    }

    // Calculate points (use team area if available, otherwise default to 3 points)
    const points = calculateHuntPoints(fox_area, teamMembership?.area);

    // Create hunt record
    const huntData = {
      hunter_team_id: teamMembership?.id || null,
      hunter_user_id: req.user!.id,
      fox_area,
      hunt_lat: lat,
      hunt_lng: lng,
      photo_url: `/api/uploads/hunts/${req.file.filename}`,
      points_awarded: points,
      status: 'pending', // Will be reviewed by admin
      hunt_time: new Date(),
      tenant_id: req.tenantId,
    };

    const [huntId] = await db('hunts').insert(huntData).returning('id');

    // Get full hunt data with user info
    const hunt = await db('hunts')
      .select('hunts.*', 'users.username', 'users.first_name', 'users.last_name')
      .join('users', 'hunts.hunter_user_id', 'users.id')
      .where('hunts.id', huntId)
      .first();

    // Emit to team members
    const io = getSocketIO();
    if (teamMembership?.id) {
      io.to(`team-${teamMembership.id}`).emit('new-hunt', hunt);
    }

    // Emit to admins for review
    io.emit('hunt-pending-review', hunt);

    res.status(201).json(hunt);
  } catch (error) {
    console.error('Submit hunt error:', error);
    res.status(500).json({ error: 'Failed to submit hunt' });
  }
});

// Get hunt cooldowns for user
router.get('/cooldowns', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const cooldownTime = new Date(Date.now() - HUNT_COOLDOWN_MINUTES * 60 * 1000);
    
    const recentHunts = await db('hunts')
      .select('fox_area', 'hunt_time')
      .where('hunter_user_id', req.user!.id)
      .where('tenant_id', req.tenantId)
      .where('hunt_time', '>', cooldownTime)
      .orderBy('hunt_time', 'desc');

    const cooldowns = recentHunts.map(hunt => ({
      fox_area: hunt.fox_area,
      hunt_time: hunt.hunt_time,
      cooldown_until: new Date(new Date(hunt.hunt_time).getTime() + HUNT_COOLDOWN_MINUTES * 60 * 1000)
    }));

    res.json(cooldowns);
  } catch (error) {
    console.error('Get cooldowns error:', error);
    res.status(500).json({ error: 'Failed to get cooldowns' });
  }
});

// Admin: Get all pending hunts
router.get('/pending', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const pendingHunts = await db('hunts')
      .select(
        'hunts.*',
        'users.username',
        'users.first_name',
        'users.last_name',
        'teams.name as team_name'
      )
      .join('users', 'hunts.hunter_user_id', 'users.id')
      .leftJoin('teams', 'hunts.hunter_team_id', 'teams.id')
      .where('hunts.status', 'pending')
      .where('hunts.tenant_id', req.tenantId)
      .orderBy('hunts.hunt_time', 'desc');

    res.json(pendingHunts);
  } catch (error) {
    console.error('Get pending hunts error:', error);
    res.status(500).json({ error: 'Failed to get pending hunts' });
  }
});

// Admin: Approve/Reject hunt
router.put('/:hunt_id/review', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const { hunt_id } = req.params;
    const { status, rejection_reason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    if (status === 'rejected' && !rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason required' });
    }

    const updateData: any = { status };
    if (status === 'rejected') {
      updateData.rejection_reason = rejection_reason;
      updateData.points_awarded = 0;
    }

    await db('hunts').where('id', hunt_id).where('tenant_id', req.tenantId).update(updateData);

    const hunt = await db('hunts')
      .select(
        'hunts.*',
        'users.username',
        'users.first_name',
        'users.last_name',
        'teams.name as team_name'
      )
      .join('users', 'hunts.hunter_user_id', 'users.id')
      .leftJoin('teams', 'hunts.hunter_team_id', 'teams.id')
      .where('hunts.id', hunt_id)
      .where('hunts.tenant_id', req.tenantId)
      .first();

    if (!hunt) {
      return res.status(404).json({ error: 'Hunt not found' });
    }

    // Emit to team members
    const io = getSocketIO();
    io.to(`team-${hunt.hunter_team_id}`).emit('hunt-reviewed', hunt);

    res.json(hunt);
  } catch (error) {
    console.error('Review hunt error:', error);
    res.status(500).json({ error: 'Failed to review hunt' });
  }
});

// Get hunt statistics
router.get('/stats', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const { team_id } = req.query;
    
    let statsQuery = db('hunts').where('tenant_id', req.tenantId);
    
    if (team_id) {
      // Check access
      const membership = await db('team_members')
        .where({ user_id: req.user!.id, team_id })
        .first();

      if (!membership && !isAdmin(req.user!)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      statsQuery = statsQuery.where('hunter_team_id', team_id);
    } else if (!isAdmin(req.user!)) {
      // Regular users can only see their own team stats
      const membership = await db('team_members')
        .where('user_id', req.user!.id)
        .first();
        
      if (membership) {
        statsQuery = statsQuery.where('hunter_team_id', membership.team_id);
      }
    }

    const stats = await statsQuery
      .select(
        db.raw('COUNT(*) as total_hunts'),
        db.raw('COUNT(CASE WHEN status = "approved" THEN 1 END) as approved_hunts'),
        db.raw('COUNT(CASE WHEN status = "rejected" THEN 1 END) as rejected_hunts'),
        db.raw('COUNT(CASE WHEN status = "pending" THEN 1 END) as pending_hunts'),
        db.raw('SUM(CASE WHEN status = "approved" THEN points_awarded ELSE 0 END) as total_points')
      )
      .first();

    res.json(stats);
  } catch (error) {
    console.error('Get hunt stats error:', error);
    res.status(500).json({ error: 'Failed to get hunt statistics' });
  }
});

export default router;