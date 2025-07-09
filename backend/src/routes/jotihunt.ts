import express from 'express';
import { db } from '../utils/database';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { getSocketIO } from '../socketManager';
import { JotihuntApiService } from '../services/jotihuntApi';

const router = express.Router();

router.get('/areas', authenticateToken, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=30');
    
    const { include_locations = 'false' } = req.query;
    
    const areas = await db('areas')
      .select('*')
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

router.get('/articles', authenticateToken, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=60');
    
    const { type, area } = req.query;
    
    let query = db('articles')
      .where('is_active', true)
      .orderBy('published_at', 'desc');

    if (type) {
      query = query.where('type', type as string);
    }

    if (area) {
      query = query.where(function() {
        this.where('area', area as string).orWhereNull('area');
      });
    }

    const articles = await query;
    res.json(articles);
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({ error: 'Failed to get articles' });
  }
});

// Get individual article by ID
router.get('/articles/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const article = await db('articles')
      .where('id', id)
      .where('is_active', true)
      .first();

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(article);
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ error: 'Failed to get article' });
  }
});

router.get('/subscriptions', authenticateToken, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=30');
    
    const subscriptions = await db('subscriptions')
      .where('is_participating', true)
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
        interval: '2 minutes',
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

// Admin: Update fox team location
router.post('/areas/:area_id/location', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { area_id } = req.params;
    const { lat, lng, source = 'manual' } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const area = await db('areas').where('id', area_id).first();
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    // Update area with latest location
    await db('areas')
      .where('id', area_id)
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
      recorded_at: new Date()
    });

    const updatedArea = await db('areas').where('id', area_id).first();

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

// Get fox status history
router.get('/fox-status-history', authenticateToken, async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    // Get recent area updates (status changes)
    const statusHistory = await db('areas')
      .select('id', 'name', 'fox_team_name', 'status', 'updated_at', 'last_seen')
      .orderBy('updated_at', 'desc')
      .limit(parseInt(limit as string));

    res.json(statusHistory);
  } catch (error) {
    console.error('Get fox status history error:', error);
    res.status(500).json({ error: 'Failed to get fox status history' });
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
          recorded_at: new Date()
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

export default router;