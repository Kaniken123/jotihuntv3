import express from 'express';
import { db } from '../utils/database';
import { authenticateToken, requireAdmin, enforceTenantIsolation } from '../middleware/auth';
import { getSocketIO } from '../socketManager';
import { JotihuntApiService } from '../services/jotihuntApi';

const router = express.Router();

router.get('/areas', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=30');
    
    const { include_locations = 'false' } = req.query;
    
    const areas = await db('areas')
      .select('*')
      .where('tenant_id', req.tenantId)
      .orderBy('name');

    // Only fetch location history if explicitly requested
    if (include_locations === 'true') {
      const areaIds = areas.map(area => area.id);
      
      // Get only the 3 most recent locations per area for performance
      const allLocations = await db('area_locations')
        .whereIn('area_id', areaIds)
        .orderBy('recorded_at', 'desc')
        .limit(areaIds.length * 3);

      const locationsByArea = allLocations.reduce((acc, location) => {
        if (!acc[location.area_id]) acc[location.area_id] = [];
        if (acc[location.area_id].length < 3) {
          acc[location.area_id].push(location);
        }
        return acc;
      }, {} as Record<number, any[]>);

      const areasWithLocations = areas.map(area => ({
        ...area,
        locations: locationsByArea[area.id] || []
      }));

      return res.json(areasWithLocations);
    }

    // Return areas without location history for faster map loading
    res.json(areas);
  } catch (error) {
    console.error('Get areas error:', error);
    res.status(500).json({ error: 'Failed to get areas' });
  }
});

// Get fox route history for a specific area  
router.get('/areas/:areaId/route', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const { areaId } = req.params;
    const { limit = '100', hours = '24' } = req.query;
    
    // Validate area exists and belongs to current tenant
    const area = await db('areas')
      .where('id', areaId)
      .where('tenant_id', req.tenantId)
      .first();
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }
    
    // Get route history for the specified time period
    const timeThreshold = Date.now() - parseInt(hours as string) * 60 * 60 * 1000;
    
    const routePoints = await db('area_locations')
      .where('area_id', areaId)
      .where('recorded_at', '>', timeThreshold)
      .orderBy('recorded_at', 'asc')
      .limit(parseInt(limit as string));
    
    // Transform route points to have proper date format
    const transformedRoutePoints = routePoints.map(point => ({
      ...point,
      recorded_at: new Date(point.recorded_at).toISOString()
    }));
    
    res.json({
      area: {
        id: area.id,
        name: area.name,
        fox_team_name: area.fox_team_name
      },
      route: transformedRoutePoints,
      route_stats: {
        total_points: transformedRoutePoints.length,
        time_span_hours: parseInt(hours as string),
        first_point: transformedRoutePoints[0]?.recorded_at || null,
        last_point: transformedRoutePoints[transformedRoutePoints.length - 1]?.recorded_at || null
      }
    });
  } catch (error) {
    console.error('Get fox route error:', error);
    res.status(500).json({ error: 'Failed to get fox route' });
  }
});

router.get('/articles', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=60');
    
    const { type, area } = req.query;
    const userId = req.user!.id;
    
    let query = db('articles')
      .select(
        'articles.*',
        'user_article_reads.read_at',
        'user_assignment_completions.is_completed',
        'user_assignment_completions.completed_at',
        'user_assignment_completions.completion_notes'
      )
      .leftJoin('user_article_reads', function() {
        this.on('articles.id', 'user_article_reads.article_id')
            .andOn('user_article_reads.user_id', '=', db.raw('?', [userId]));
      })
      .leftJoin('user_assignment_completions', function() {
        this.on('articles.id', 'user_assignment_completions.article_id')
            .andOn('user_assignment_completions.user_id', '=', db.raw('?', [userId]));
      })
      .where('articles.is_active', true)
      .where('articles.tenant_id', req.tenantId)
      .orderBy('articles.published_at', 'desc');

    if (type) {
      query = query.where('articles.type', type as string);
    }

    if (area) {
      query = query.where(function() {
        this.where('articles.area', area as string).orWhereNull('articles.area');
      });
    }

    const articles = await query;
    
    // Transform results to include read and completion status
    const articlesWithStatus = articles.map(article => ({
      ...article,
      is_read: !!article.read_at,
      is_completed: article.type === 'assignment' ? !!article.is_completed : undefined
    }));

    res.json(articlesWithStatus);
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({ error: 'Failed to get articles' });
  }
});

// Get individual article by ID
router.get('/articles/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const article = await db('articles')
      .select(
        'articles.*',
        'user_article_reads.read_at',
        'user_assignment_completions.is_completed',
        'user_assignment_completions.completed_at',
        'user_assignment_completions.completion_notes'
      )
      .leftJoin('user_article_reads', function() {
        this.on('articles.id', 'user_article_reads.article_id')
            .andOn('user_article_reads.user_id', '=', db.raw('?', [userId]));
      })
      .leftJoin('user_assignment_completions', function() {
        this.on('articles.id', 'user_assignment_completions.article_id')
            .andOn('user_assignment_completions.user_id', '=', db.raw('?', [userId]));
      })
      .where('articles.id', id)
      .where('articles.is_active', true)
      .first();

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Transform result to include read and completion status
    const articleWithStatus = {
      ...article,
      is_read: !!article.read_at,
      is_completed: article.type === 'assignment' ? !!article.is_completed : undefined
    };

    res.json(articleWithStatus);
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ error: 'Failed to get article' });
  }
});

// Mark article as read
router.post('/articles/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if article exists
    const article = await db('articles')
      .where('id', id)
      .where('is_active', true)
      .first();

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Insert or update read status
    await db('user_article_reads')
      .insert({
        user_id: userId,
        article_id: parseInt(id),
        read_at: new Date()
      })
      .onConflict(['user_id', 'article_id'])
      .merge({
        read_at: new Date()
      });

    res.json({ message: 'Article marked as read' });
  } catch (error) {
    console.error('Mark article as read error:', error);
    res.status(500).json({ error: 'Failed to mark article as read' });
  }
});

// Toggle assignment completion
router.post('/articles/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_completed, completion_notes } = req.body;
    const userId = req.user!.id;

    // Check if article exists and is an assignment
    const article = await db('articles')
      .where('id', id)
      .where('type', 'assignment')
      .where('is_active', true)
      .first();

    if (!article) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Insert or update completion status
    await db('user_assignment_completions')
      .insert({
        user_id: userId,
        article_id: parseInt(id),
        is_completed: !!is_completed,
        completion_notes: completion_notes || null,
        completed_at: is_completed ? new Date() : null,
        updated_at: new Date()
      })
      .onConflict(['user_id', 'article_id'])
      .merge({
        is_completed: !!is_completed,
        completion_notes: completion_notes || null,
        completed_at: is_completed ? new Date() : null,
        updated_at: new Date()
      });

    res.json({ 
      message: is_completed ? 'Assignment marked as completed' : 'Assignment marked as incomplete',
      is_completed: !!is_completed
    });
  } catch (error) {
    console.error('Update assignment completion error:', error);
    res.status(500).json({ error: 'Failed to update assignment completion' });
  }
});

router.get('/subscriptions', authenticateToken, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=30');
    
    const subscriptions = await db('subscriptions')
      .where(function() {
        this.where('is_participating', true).orWhereNull('is_participating');
      })
      .where('tenant_id', req.user!.current_tenant_id || req.user!.tenant_id)
      .orderBy('team_name');

    const subscriptionIds = subscriptions.map(sub => sub.id);
    const allLocations = await db('subscription_locations')
      .whereIn('subscription_id', subscriptionIds)
      .orderBy('recorded_at', 'desc');

    const locationsBySubscription = allLocations.reduce((acc, location) => {
      if (!acc[location.subscription_id]) acc[location.subscription_id] = [];
      if (acc[location.subscription_id].length < 5) {
        acc[location.subscription_id].push(location);
      }
      return acc;
    }, {} as Record<number, any[]>);

    const subscriptionsWithLocations = subscriptions.map(subscription => ({
      ...subscription,
      locations: locationsBySubscription[subscription.id] || []
    }));

    res.json(subscriptionsWithLocations);
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
});

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const lastSync = await db('api_cache')
      .where('cache_key', 'last_sync')
      .first();

    const totalAreas = await db('areas').count('* as count').first();
    const activeAreas = await db('areas').where('status', 'active').count('* as count').first();
    const totalArticles = await db('articles').where('is_active', true).count('* as count').first();

    res.json({
      last_sync: lastSync?.last_sync,
      total_areas: totalAreas?.count || 0,
      active_areas: activeAreas?.count || 0,
      total_articles: totalArticles?.count || 0,
      api_status: 'connected'
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

router.post('/sync', authenticateToken, async (req, res) => {
  try {
    console.log('Starting manual sync with Jotihunt APIs...');
    const results = await JotihuntApiService.syncAll();
    
    await db('api_cache')
      .insert({
        cache_key: 'last_sync',
        data: JSON.stringify({ manual_sync: true, results }),
        last_sync: new Date()
      })
      .onConflict('cache_key')
      .merge();

    res.json({ 
      message: 'Sync completed', 
      timestamp: new Date(),
      results 
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Get external API data directly (for testing/debugging)
router.get('/external/subscriptions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const subscriptions = await JotihuntApiService.getSubscriptions();
    res.json({ external_data: subscriptions, count: subscriptions.length });
  } catch (error) {
    console.error('External subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch external subscriptions' });
  }
});

router.get('/external/areas', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const areas = await JotihuntApiService.getAreas();
    res.json({ external_data: areas, count: areas.length });
  } catch (error) {
    console.error('External areas error:', error);
    res.status(500).json({ error: 'Failed to fetch external areas' });
  }
});

router.get('/external/articles', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const articles = await JotihuntApiService.getArticles();
    res.json({ external_data: articles, count: articles.length });
  } catch (error) {
    console.error('External articles error:', error);
    res.status(500).json({ error: 'Failed to fetch external articles' });
  }
});

// Sync individual endpoints
router.post('/sync/subscriptions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await JotihuntApiService.syncSubscriptions();
    res.json({ message: 'Subscriptions synced', result });
  } catch (error) {
    console.error('Subscriptions sync error:', error);
    res.status(500).json({ error: 'Failed to sync subscriptions' });
  }
});

router.post('/sync/areas', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await JotihuntApiService.syncAreas();
    res.json({ message: 'Areas synced', result });
  } catch (error) {
    console.error('Areas sync error:', error);
    res.status(500).json({ error: 'Failed to sync areas' });
  }
});

router.post('/sync/articles', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await JotihuntApiService.syncArticles();
    res.json({ message: 'Articles synced', result });
  } catch (error) {
    console.error('Articles sync error:', error);
    res.status(500).json({ error: 'Failed to sync articles' });
  }
});

// Get sync status
router.get('/sync/status', authenticateToken, async (req, res) => {
  try {
    const status = await JotihuntApiService.getSyncStatus();
    
    // Add auto-sync information
    const enableAutoSync = process.env.ENABLE_AUTO_SYNC !== 'false';
    const autoSyncCache = await db('api_cache').where('cache_key', 'last_auto_sync').first();
    
    res.json({
      ...status,
      auto_sync: {
        enabled: enableAutoSync,
        interval: '3 minutes',
        last_auto_sync: autoSyncCache?.last_sync || null,
        last_auto_sync_data: autoSyncCache ? JSON.parse(autoSyncCache.data || '{}') : null
      }
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Admin: Update fox team status
router.put('/areas/:area_id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { area_id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'inactive', 'hunted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be active, inactive, or hunted' });
    }

    await db('areas')
      .where('id', area_id)
      .update({
        status,
        updated_at: new Date()
      });

    const area = await db('areas').where('id', area_id).first();

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    // Emit real-time update
    try {
      const io = getSocketIO();
      io.emit('fox-status-update', {
        area_id: parseInt(area_id),
        name: area.name,
        fox_team_name: area.fox_team_name,
        status,
        reason,
        updated_at: new Date()
      });
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    res.json(area);
  } catch (error) {
    console.error('Update area status error:', error);
    res.status(500).json({ error: 'Failed to update area status' });
  }
});

// Update fox team location (accessible to all users for reporting)
router.post('/areas/:area_id/location', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const { area_id } = req.params;
    const { lat, lng, source = 'user_report' } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const area = await db('areas')
      .where('id', area_id)
      .where('tenant_id', req.tenantId)
      .first();
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    // Update area with latest location
    await db('areas')
      .where('id', area_id)
      .where('tenant_id', req.tenantId)
      .update({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        last_seen: new Date(),
        updated_at: new Date()
      });

    // Add location to history
    await db('area_locations').insert({
      area_id: parseInt(area_id),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      source,
      recorded_at: Date.now()
    });

    const updatedArea = await db('areas')
      .where('id', area_id)
      .where('tenant_id', req.tenantId)
      .first();

    // Emit real-time location update
    try {
      const io = getSocketIO();
      io.emit('fox-location-update', {
        area_id: parseInt(area_id),
        name: area.name,
        fox_team_name: area.fox_team_name,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        last_seen: new Date(),
        source
      });
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    res.json(updatedArea);
  } catch (error) {
    console.error('Update area location error:', error);
    res.status(500).json({ error: 'Failed to update area location' });
  }
});

// Get fox team location history
router.get('/areas/:area_id/locations', authenticateToken, async (req, res) => {
  try {
    const { area_id } = req.params;
    const { limit = 50 } = req.query;

    const locations = await db('area_locations')
      .where('area_id', area_id)
      .orderBy('recorded_at', 'desc')
      .limit(parseInt(limit as string));

    res.json(locations);
  } catch (error) {
    console.error('Get area locations error:', error);
    res.status(500).json({ error: 'Failed to get area locations' });
  }
});

// Get fox status history with duration analytics
router.get('/fox-status-history', authenticateToken, async (req, res) => {
  try {
    const { area_id, limit = 100, api_status } = req.query;
    const tenantId = (req as any).user.current_tenant_id || (req as any).user.tenant_id;

    let query = db('fox_status_history')
      .select('*')
      .where('tenant_id', tenantId)
      .orderBy('started_at', 'desc');

    if (area_id) {
      query = query.where('area_id', parseInt(area_id as string));
    }

    if (api_status) {
      query = query.where('api_status', api_status as string);
    }

    const statusHistory = await query.limit(parseInt(limit as string));

    res.json(statusHistory);
  } catch (error) {
    console.error('Get fox status history error:', error);
    res.status(500).json({ error: 'Failed to get fox status history' });
  }
});

// Get fox status analytics (average durations per status)
router.get('/fox-status-analytics', authenticateToken, async (req, res) => {
  try {
    const { area_id, hours = 24 } = req.query;
    const tenantId = (req as any).user.current_tenant_id || (req as any).user.tenant_id;
    const hoursAgo = new Date(Date.now() - parseInt(hours as string) * 60 * 60 * 1000);

    let query = db('fox_status_history')
      .select('api_status')
      .count('* as count')
      .avg('duration_seconds as avg_duration')
      .sum('duration_seconds as total_duration')
      .min('duration_seconds as min_duration')
      .max('duration_seconds as max_duration')
      .where('tenant_id', tenantId)
      .where('started_at', '>=', hoursAgo)
      .whereNotNull('duration_seconds')
      .groupBy('api_status');

    if (area_id) {
      query = query.where('area_id', parseInt(area_id as string));
    }

    const analytics = await query;

    // Convert seconds to human-readable format
    const formattedAnalytics = analytics.map((stat: any) => ({
      status: stat.api_status,
      count: parseInt(stat.count),
      avg_duration_seconds: Math.round(stat.avg_duration),
      avg_duration_minutes: Math.round(stat.avg_duration / 60),
      total_duration_seconds: parseInt(stat.total_duration),
      total_duration_minutes: Math.round(stat.total_duration / 60),
      min_duration_seconds: parseInt(stat.min_duration),
      max_duration_seconds: parseInt(stat.max_duration)
    }));

    res.json(formattedAnalytics);
  } catch (error) {
    console.error('Get fox status analytics error:', error);
    res.status(500).json({ error: 'Failed to get fox status analytics' });
  }
});

// Admin: Bulk update multiple fox areas
router.post('/areas/bulk-update', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }

    const results = [];

    for (const update of updates) {
      const { area_id, status, lat, lng, reason } = update;

      if (status) {
        await db('areas')
          .where('id', area_id)
          .update({
            status,
            updated_at: new Date()
          });
      }

      if (lat && lng) {
        await db('areas')
          .where('id', area_id)
          .update({
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            last_seen: new Date(),
            updated_at: new Date()
          });

        await db('area_locations').insert({
          area_id: parseInt(area_id),
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          source: 'bulk_update',
          recorded_at: Date.now()
        });
      }

      const area = await db('areas').where('id', area_id).first();
      results.push(area);
    }

    // Emit bulk update notification
    try {
      const io = getSocketIO();
      io.emit('fox-bulk-update', {
        updated_areas: results,
        timestamp: new Date()
      });
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    res.json({
      message: 'Bulk update completed',
      updated_count: results.length,
      areas: results
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});

// Admin: Reset all fox locations (clear lat/lng and last_seen)
router.post('/areas/reset-locations', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    // Clear lat, lng, and last_seen from all areas for this tenant
    const updatedCount = await db('areas')
      .where('tenant_id', tenantId)
      .update({
        lat: null,
        lng: null,
        last_seen: null,
        updated_at: new Date()
      });

    // Optionally: Delete all area_locations history (uncomment if you want to clear history too)
    // const areaIds = await db('areas').where('tenant_id', tenantId).pluck('id');
    // await db('area_locations').whereIn('area_id', areaIds).delete();

    // Emit notification to all connected clients
    try {
      const io = getSocketIO();
      io.emit('fox-locations-reset', {
        tenant_id: tenantId,
        timestamp: new Date(),
        message: 'All fox locations have been reset by admin'
      });
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    res.json({
      message: 'All fox locations have been reset successfully',
      areas_updated: updatedCount
    });
  } catch (error) {
    console.error('Reset fox locations error:', error);
    res.status(500).json({ error: 'Failed to reset fox locations' });
  }
});

// SUBSCRIPTION MANAGEMENT ENDPOINTS

// Admin: Record fox visit to subscription/group
router.post('/subscriptions/:subscription_id/visit', authenticateToken, async (req, res) => {
  try {
    const { subscription_id } = req.params;
    const { fox_team_name, visit_lat, visit_lng, notes } = req.body;

    if (!fox_team_name || !visit_lat || !visit_lng) {
      return res.status(400).json({ error: 'Fox team name and visit coordinates are required' });
    }

    // Get fox area for the team
    const foxArea = await db('areas')
      .where('name', fox_team_name)
      .where('tenant_id', req.user!.tenant_id)
      .first();

    if (!foxArea) {
      return res.status(400).json({ error: 'Fox team not found' });
    }

    // Verify subscription exists
    const subscription = await db('subscriptions')
      .where('id', subscription_id)
      .where('tenant_id', req.user!.tenant_id)
      .first();

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Record the visit (will replace existing visit from same fox team)
    await db('subscription_visits')
      .insert({
        subscription_id: parseInt(subscription_id),
        area_id: foxArea.id,
        fox_team_name,
        visit_lat: parseFloat(visit_lat),
        visit_lng: parseFloat(visit_lng),
        user_id: req.user!.id,
        notes,
        tenant_id: req.user!.tenant_id,
        created_at: new Date(),
        updated_at: new Date()
      })
      .onConflict(['subscription_id', 'area_id', 'tenant_id'])
      .merge({
        visit_lat: parseFloat(visit_lat),
        visit_lng: parseFloat(visit_lng),
        user_id: req.user!.id,
        notes,
        updated_at: new Date()
      });

    // Get updated subscription with visit info
    const subscriptionWithVisits = await db('subscriptions')
      .select('subscriptions.*')
      .where('subscriptions.id', subscription_id)
      .where('subscriptions.tenant_id', req.user!.tenant_id)
      .first();

    // Get all visits for this subscription
    const visits = await db('subscription_visits')
      .where('subscription_id', subscription_id)
      .where('tenant_id', req.user!.tenant_id)
      .orderBy('created_at', 'desc');

    res.json({
      message: 'Visit recorded successfully',
      subscription: {
        ...subscriptionWithVisits,
        visits,
        visited_by_foxes: visits.map(v => v.fox_team_name)
      }
    });
  } catch (error) {
    console.error('Record visit error:', error);
    res.status(500).json({ error: 'Failed to record visit' });
  }
});

// Get subscription with visit history
router.get('/subscriptions/:subscription_id/visits', authenticateToken, async (req, res) => {
  try {
    const { subscription_id } = req.params;

    const subscription = await db('subscriptions')
      .where('id', subscription_id)
      .where('tenant_id', req.user!.tenant_id)
      .first();

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const visits = await db('subscription_visits')
      .select(
        'subscription_visits.*',
        'users.username',
        'users.first_name',
        'users.last_name'
      )
      .leftJoin('users', 'subscription_visits.user_id', 'users.id')
      .where('subscription_visits.subscription_id', subscription_id)
      .where('subscription_visits.tenant_id', req.user!.tenant_id)
      .orderBy('subscription_visits.created_at', 'desc');

    res.json({
      subscription,
      visits,
      visited_by_foxes: visits.map(v => v.fox_team_name)
    });
  } catch (error) {
    console.error('Get subscription visits error:', error);
    res.status(500).json({ error: 'Failed to get subscription visits' });
  }
});

// Update subscriptions endpoint to include visit data
router.get('/subscriptions-with-visits', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Fetching subscriptions for tenant:', req.user!.tenant_id);
    res.setHeader('Cache-Control', 'private, max-age=30');

    const subscriptions = await db('subscriptions')
      .where('tenant_id', req.user!.tenant_id)
      .where('is_participating', true)
      .orderBy('team_name');

    console.log('📊 Found subscriptions:', subscriptions.length);

    // Get all visits for these subscriptions
    const subscriptionIds = subscriptions.map(sub => sub.id);
    const visits = await db('subscription_visits')
      .whereIn('subscription_id', subscriptionIds)
      .where('tenant_id', req.user!.tenant_id);

    // Group visits by subscription
    const visitsBySubscription = visits.reduce((acc, visit) => {
      if (!acc[visit.subscription_id]) acc[visit.subscription_id] = [];
      acc[visit.subscription_id].push(visit);
      return acc;
    }, {} as Record<number, any[]>);

    // Add visit data to subscriptions
    const subscriptionsWithVisits = subscriptions.map(subscription => ({
      ...subscription,
      visits: visitsBySubscription[subscription.id] || [],
      visited_by_foxes: visitsBySubscription[subscription.id]?.map((v: any) => v.fox_team_name) || [],
      visit_count: visitsBySubscription[subscription.id]?.length || 0
    }));

    res.json(subscriptionsWithVisits);
  } catch (error) {
    console.error('Get subscriptions with visits error:', error);
    res.status(500).json({ error: 'Failed to get subscriptions with visits' });
  }
});

// Note: Subscription area is now read-only and automatically synced from the Jotihunt API
// Manual updates have been removed to maintain data consistency with the external API

export default router;