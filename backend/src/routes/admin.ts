import express from 'express';
import { db } from '../utils/database';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalTeams,
      pendingHunts,
      totalHunts,
      activeAreas,
      totalMessages
    ] = await Promise.all([
      db('users').count('* as count').first(),
      db('teams').count('* as count').first(),
      db('hunts').where('status', 'pending').count('* as count').first(),
      db('hunts').count('* as count').first(),
      db('areas').where('status', 'active').count('* as count').first(),
      db('team_messages').count('* as count').first()
    ]);

    res.json({
      total_users: totalUsers?.count || 0,
      total_teams: totalTeams?.count || 0,
      pending_hunts: pendingHunts?.count || 0,
      total_hunts: totalHunts?.count || 0,
      active_areas: activeAreas?.count || 0,
      total_messages: totalMessages?.count || 0
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Get game analytics
router.get('/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    
    let timeFilter = new Date();
    switch (period) {
      case '1h':
        timeFilter.setHours(timeFilter.getHours() - 1);
        break;
      case '24h':
        timeFilter.setDate(timeFilter.getDate() - 1);
        break;
      case '7d':
        timeFilter.setDate(timeFilter.getDate() - 7);
        break;
      default:
        timeFilter.setDate(timeFilter.getDate() - 1);
    }

    const [
      recentHunts,
      huntsByArea,
      topTeams,
      messageActivity
    ] = await Promise.all([
      // Recent hunts with status breakdown
      db('hunts')
        .select('status')
        .count('* as count')
        .where('hunt_time', '>=', timeFilter)
        .groupBy('status'),
      
      // Hunts by area
      db('hunts')
        .select('fox_area')
        .count('* as count')
        .sum('points_awarded as total_points')
        .where('hunt_time', '>=', timeFilter)
        .groupBy('fox_area'),
      
      // Top performing teams
      db('hunts')
        .select('teams.name as team_name')
        .sum('hunts.points_awarded as total_points')
        .count('hunts.id as hunt_count')
        .join('teams', 'hunts.hunter_team_id', 'teams.id')
        .where('hunts.status', 'approved')
        .groupBy('teams.id', 'teams.name')
        .orderBy('total_points', 'desc')
        .limit(10),
      
      // Message activity
      db('team_messages')
        .select(db.raw('DATE(created_at) as date'))
        .count('* as count')
        .where('created_at', '>=', timeFilter)
        .groupBy(db.raw('DATE(created_at)'))
        .orderBy('date')
    ]);

    res.json({
      period,
      recent_hunts: recentHunts,
      hunts_by_area: huntsByArea,
      top_teams: topTeams,
      message_activity: messageActivity,
      generated_at: new Date()
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Update area status
router.put('/areas/:area_id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { area_id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'inactive', 'hunted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await db('areas')
      .where('id', area_id)
      .update({
        status,
        updated_at: new Date()
      });

    // Log the change
    await db('admin_actions').insert({
      admin_user_id: req.user!.id,
      action: 'area_status_change',
      target_type: 'area',
      target_id: area_id,
      details: JSON.stringify({ new_status: status, reason }),
      performed_at: new Date()
    }).catch(() => {
      // Table might not exist yet, ignore for now
    });

    const area = await db('areas').where('id', area_id).first();
    res.json(area);
  } catch (error) {
    console.error('Update area status error:', error);
    res.status(500).json({ error: 'Failed to update area status' });
  }
});

// Get system logs
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;

    // This would require a proper logging table
    // For now, return recent activities from various tables
    const activities: any[] = [];

    // Recent hunts
    const recentHunts = await db('hunts')
      .select(
        'hunts.*',
        'users.username',
        'teams.name as team_name'
      )
      .join('users', 'hunts.hunter_user_id', 'users.id')
      .join('teams', 'hunts.hunter_team_id', 'teams.id')
      .orderBy('hunts.hunt_time', 'desc')
      .limit(20);

    recentHunts.forEach(hunt => {
      activities.push({
        id: `hunt_${hunt.id}`,
        type: 'hunt',
        timestamp: hunt.hunt_time,
        description: `${hunt.username} submitted hunt for ${hunt.fox_area}`,
        status: hunt.status,
        details: hunt
      });
    });

    // Recent user registrations
    const recentUsers = await db('users')
      .select('id', 'username', 'created_at', 'role')
      .orderBy('created_at', 'desc')
      .limit(10);

    recentUsers.forEach(user => {
      activities.push({
        id: `user_${user.id}`,
        type: 'user_registration',
        timestamp: user.created_at,
        description: `New ${user.role} registered: ${user.username}`,
        status: 'completed',
        details: user
      });
    });

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const paginatedActivities = activities.slice(
      parseInt(offset as string),
      parseInt(offset as string) + parseInt(limit as string)
    );

    res.json({
      activities: paginatedActivities,
      total: activities.length,
      has_more: activities.length > parseInt(offset as string) + parseInt(limit as string)
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to get system logs' });
  }
});

// Bulk actions
router.post('/bulk-actions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { action, target_type, target_ids, parameters } = req.body;

    let results = [];

    switch (action) {
      case 'approve_hunts':
        if (target_type === 'hunt') {
          for (const huntId of target_ids) {
            await db('hunts')
              .where('id', huntId)
              .update({ status: 'approved' });
            results.push({ id: huntId, status: 'approved' });
          }
        }
        break;

      case 'reject_hunts':
        if (target_type === 'hunt') {
          for (const huntId of target_ids) {
            await db('hunts')
              .where('id', huntId)
              .update({ 
                status: 'rejected',
                rejection_reason: parameters?.reason || 'Bulk rejection',
                points_awarded: 0
              });
            results.push({ id: huntId, status: 'rejected' });
          }
        }
        break;

      case 'deactivate_users':
        if (target_type === 'user') {
          await db('users')
            .whereIn('id', target_ids)
            .update({ is_active: false });
          results = target_ids.map((id: any) => ({ id, status: 'deactivated' }));
        }
        break;

      default:
        return res.status(400).json({ error: 'Unknown bulk action' });
    }

    res.json({
      action,
      processed: results.length,
      results
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({ error: 'Failed to perform bulk action' });
  }
});

// Export data
router.get('/export/:type', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'json' } = req.query;

    let data = [];
    let filename = '';

    switch (type) {
      case 'hunts':
        data = await db('hunts')
          .select(
            'hunts.*',
            'users.username',
            'teams.name as team_name'
          )
          .join('users', 'hunts.hunter_user_id', 'users.id')
          .join('teams', 'hunts.hunter_team_id', 'teams.id')
          .orderBy('hunts.hunt_time', 'desc');
        filename = `hunts_export_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'users':
        data = await db('users')
          .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at');
        filename = `users_export_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'leaderboard':
        data = await db('hunts')
          .select('teams.name as team_name')
          .sum('hunts.points_awarded as total_points')
          .count('hunts.id as hunt_count')
          .join('teams', 'hunts.hunter_team_id', 'teams.id')
          .where('hunts.status', 'approved')
          .groupBy('teams.id', 'teams.name')
          .orderBy('total_points', 'desc');
        filename = `leaderboard_export_${new Date().toISOString().split('T')[0]}`;
        break;

      default:
        return res.status(400).json({ error: 'Unknown export type' });
    }

    if (format === 'csv') {
      // Simple CSV export
      if (data.length > 0) {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => 
          Object.values(row).map(value => 
            typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
          ).join(',')
        );
        const csv = [headers, ...rows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send(csv);
      }
    }

    // JSON export (default)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.json({
      export_type: type,
      generated_at: new Date(),
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;