"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const socketManager_1 = require("../socketManager");
const jotihuntApi_1 = require("../services/jotihuntApi");
const router = express_1.default.Router();
router.get('/areas', auth_1.authenticateToken, auth_1.enforceTenantIsolation, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'private, max-age=30');
        const { include_locations = 'false' } = req.query;
        const areas = await (0, database_1.db)('areas')
            .select('*')
            .where('tenant_id', req.tenantId)
            .orderBy('name');
        // Only fetch location history if explicitly requested
        if (include_locations === 'true') {
            const areaIds = areas.map(area => area.id);
            // Get only the 3 most recent locations per area for performance
            const allLocations = await (0, database_1.db)('area_locations')
                .whereIn('area_id', areaIds)
                .orderBy('recorded_at', 'desc')
                .limit(areaIds.length * 3);
            const locationsByArea = allLocations.reduce((acc, location) => {
                if (!acc[location.area_id])
                    acc[location.area_id] = [];
                if (acc[location.area_id].length < 3) {
                    acc[location.area_id].push(location);
                }
                return acc;
            }, {});
            const areasWithLocations = areas.map(area => ({
                ...area,
                locations: locationsByArea[area.id] || []
            }));
            return res.json(areasWithLocations);
        }
        // Return areas without location history for faster map loading
        res.json(areas);
    }
    catch (error) {
        console.error('Get areas error:', error);
        res.status(500).json({ error: 'Failed to get areas' });
    }
});
// Get fox route history for a specific area  
router.get('/areas/:areaId/route', auth_1.authenticateToken, auth_1.enforceTenantIsolation, async (req, res) => {
    try {
        const { areaId } = req.params;
        const { limit = '100', hours = '24' } = req.query;
        // Validate area exists and belongs to current tenant
        const area = await (0, database_1.db)('areas')
            .where('id', areaId)
            .where('tenant_id', req.tenantId)
            .first();
        if (!area) {
            return res.status(404).json({ error: 'Area not found' });
        }
        // Get route history for the specified time period
        const timeThreshold = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
        const routePoints = await (0, database_1.db)('area_locations')
            .where('area_id', areaId)
            .where('recorded_at', '>', timeThreshold)
            .orderBy('recorded_at', 'asc')
            .limit(parseInt(limit));
        res.json({
            area: {
                id: area.id,
                name: area.name,
                fox_team_name: area.fox_team_name
            },
            route: routePoints,
            route_stats: {
                total_points: routePoints.length,
                time_span_hours: parseInt(hours),
                first_point: routePoints[0]?.recorded_at || null,
                last_point: routePoints[routePoints.length - 1]?.recorded_at || null
            }
        });
    }
    catch (error) {
        console.error('Get fox route error:', error);
        res.status(500).json({ error: 'Failed to get fox route' });
    }
});
router.get('/articles', auth_1.authenticateToken, auth_1.enforceTenantIsolation, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'private, max-age=60');
        const { type, area } = req.query;
        const userId = req.user.id;
        let query = (0, database_1.db)('articles')
            .select('articles.*', 'user_article_reads.read_at', 'user_assignment_completions.is_completed', 'user_assignment_completions.completed_at', 'user_assignment_completions.completion_notes')
            .leftJoin('user_article_reads', function () {
            this.on('articles.id', 'user_article_reads.article_id')
                .andOn('user_article_reads.user_id', '=', database_1.db.raw('?', [userId]));
        })
            .leftJoin('user_assignment_completions', function () {
            this.on('articles.id', 'user_assignment_completions.article_id')
                .andOn('user_assignment_completions.user_id', '=', database_1.db.raw('?', [userId]));
        })
            .where('articles.is_active', true)
            .where('articles.tenant_id', req.tenantId)
            .orderBy('articles.published_at', 'desc');
        if (type) {
            query = query.where('articles.type', type);
        }
        if (area) {
            query = query.where(function () {
                this.where('articles.area', area).orWhereNull('articles.area');
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
    }
    catch (error) {
        console.error('Get articles error:', error);
        res.status(500).json({ error: 'Failed to get articles' });
    }
});
// Get individual article by ID
router.get('/articles/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const article = await (0, database_1.db)('articles')
            .select('articles.*', 'user_article_reads.read_at', 'user_assignment_completions.is_completed', 'user_assignment_completions.completed_at', 'user_assignment_completions.completion_notes')
            .leftJoin('user_article_reads', function () {
            this.on('articles.id', 'user_article_reads.article_id')
                .andOn('user_article_reads.user_id', '=', database_1.db.raw('?', [userId]));
        })
            .leftJoin('user_assignment_completions', function () {
            this.on('articles.id', 'user_assignment_completions.article_id')
                .andOn('user_assignment_completions.user_id', '=', database_1.db.raw('?', [userId]));
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
    }
    catch (error) {
        console.error('Get article error:', error);
        res.status(500).json({ error: 'Failed to get article' });
    }
});
// Mark article as read
router.post('/articles/:id/read', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        // Check if article exists
        const article = await (0, database_1.db)('articles')
            .where('id', id)
            .where('is_active', true)
            .first();
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        // Insert or update read status
        await (0, database_1.db)('user_article_reads')
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
    }
    catch (error) {
        console.error('Mark article as read error:', error);
        res.status(500).json({ error: 'Failed to mark article as read' });
    }
});
// Toggle assignment completion
router.post('/articles/:id/complete', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_completed, completion_notes } = req.body;
        const userId = req.user.id;
        // Check if article exists and is an assignment
        const article = await (0, database_1.db)('articles')
            .where('id', id)
            .where('type', 'assignment')
            .where('is_active', true)
            .first();
        if (!article) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        // Insert or update completion status
        await (0, database_1.db)('user_assignment_completions')
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
    }
    catch (error) {
        console.error('Update assignment completion error:', error);
        res.status(500).json({ error: 'Failed to update assignment completion' });
    }
});
router.get('/subscriptions', auth_1.authenticateToken, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'private, max-age=30');
        const subscriptions = await (0, database_1.db)('subscriptions')
            .where(function () {
            this.where('is_participating', true).orWhereNull('is_participating');
        })
            .where('tenant_id', req.user.current_tenant_id || req.user.tenant_id)
            .orderBy('team_name');
        const subscriptionIds = subscriptions.map(sub => sub.id);
        const allLocations = await (0, database_1.db)('subscription_locations')
            .whereIn('subscription_id', subscriptionIds)
            .orderBy('recorded_at', 'desc');
        const locationsBySubscription = allLocations.reduce((acc, location) => {
            if (!acc[location.subscription_id])
                acc[location.subscription_id] = [];
            if (acc[location.subscription_id].length < 5) {
                acc[location.subscription_id].push(location);
            }
            return acc;
        }, {});
        const subscriptionsWithLocations = subscriptions.map(subscription => ({
            ...subscription,
            locations: locationsBySubscription[subscription.id] || []
        }));
        res.json(subscriptionsWithLocations);
    }
    catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({ error: 'Failed to get subscriptions' });
    }
});
router.get('/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const lastSync = await (0, database_1.db)('api_cache')
            .where('cache_key', 'last_sync')
            .first();
        const totalAreas = await (0, database_1.db)('areas').count('* as count').first();
        const activeAreas = await (0, database_1.db)('areas').where('status', 'active').count('* as count').first();
        const totalArticles = await (0, database_1.db)('articles').where('is_active', true).count('* as count').first();
        res.json({
            last_sync: lastSync?.last_sync,
            total_areas: totalAreas?.count || 0,
            active_areas: activeAreas?.count || 0,
            total_articles: totalArticles?.count || 0,
            api_status: 'connected'
        });
    }
    catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});
router.post('/sync', auth_1.authenticateToken, async (req, res) => {
    try {
        console.log('Starting manual sync with Jotihunt APIs...');
        const results = await jotihuntApi_1.JotihuntApiService.syncAll();
        await (0, database_1.db)('api_cache')
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
    }
    catch (error) {
        console.error('Manual sync error:', error);
        res.status(500).json({ error: 'Sync failed' });
    }
});
// Get external API data directly (for testing/debugging)
router.get('/external/subscriptions', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const subscriptions = await jotihuntApi_1.JotihuntApiService.getSubscriptions();
        res.json({ external_data: subscriptions, count: subscriptions.length });
    }
    catch (error) {
        console.error('External subscriptions error:', error);
        res.status(500).json({ error: 'Failed to fetch external subscriptions' });
    }
});
router.get('/external/areas', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const areas = await jotihuntApi_1.JotihuntApiService.getAreas();
        res.json({ external_data: areas, count: areas.length });
    }
    catch (error) {
        console.error('External areas error:', error);
        res.status(500).json({ error: 'Failed to fetch external areas' });
    }
});
router.get('/external/articles', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const articles = await jotihuntApi_1.JotihuntApiService.getArticles();
        res.json({ external_data: articles, count: articles.length });
    }
    catch (error) {
        console.error('External articles error:', error);
        res.status(500).json({ error: 'Failed to fetch external articles' });
    }
});
// Sync individual endpoints
router.post('/sync/subscriptions', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const result = await jotihuntApi_1.JotihuntApiService.syncSubscriptions();
        res.json({ message: 'Subscriptions synced', result });
    }
    catch (error) {
        console.error('Subscriptions sync error:', error);
        res.status(500).json({ error: 'Failed to sync subscriptions' });
    }
});
router.post('/sync/areas', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const result = await jotihuntApi_1.JotihuntApiService.syncAreas();
        res.json({ message: 'Areas synced', result });
    }
    catch (error) {
        console.error('Areas sync error:', error);
        res.status(500).json({ error: 'Failed to sync areas' });
    }
});
router.post('/sync/articles', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const result = await jotihuntApi_1.JotihuntApiService.syncArticles();
        res.json({ message: 'Articles synced', result });
    }
    catch (error) {
        console.error('Articles sync error:', error);
        res.status(500).json({ error: 'Failed to sync articles' });
    }
});
// Get sync status
router.get('/sync/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const status = await jotihuntApi_1.JotihuntApiService.getSyncStatus();
        // Add auto-sync information
        const enableAutoSync = process.env.ENABLE_AUTO_SYNC !== 'false';
        const autoSyncCache = await (0, database_1.db)('api_cache').where('cache_key', 'last_auto_sync').first();
        res.json({
            ...status,
            auto_sync: {
                enabled: enableAutoSync,
                interval: '3 minutes',
                last_auto_sync: autoSyncCache?.last_sync || null,
                last_auto_sync_data: autoSyncCache ? JSON.parse(autoSyncCache.data || '{}') : null
            }
        });
    }
    catch (error) {
        console.error('Sync status error:', error);
        res.status(500).json({ error: 'Failed to get sync status' });
    }
});
// Admin: Update fox team status
router.put('/areas/:area_id/status', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { area_id } = req.params;
        const { status, reason } = req.body;
        if (!['active', 'inactive', 'hunted'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be active, inactive, or hunted' });
        }
        await (0, database_1.db)('areas')
            .where('id', area_id)
            .update({
            status,
            updated_at: new Date()
        });
        const area = await (0, database_1.db)('areas').where('id', area_id).first();
        if (!area) {
            return res.status(404).json({ error: 'Area not found' });
        }
        // Emit real-time update
        try {
            const io = (0, socketManager_1.getSocketIO)();
            io.emit('fox-status-update', {
                area_id: parseInt(area_id),
                name: area.name,
                fox_team_name: area.fox_team_name,
                status,
                reason,
                updated_at: new Date()
            });
        }
        catch (socketError) {
            console.error('Socket emission error:', socketError);
        }
        res.json(area);
    }
    catch (error) {
        console.error('Update area status error:', error);
        res.status(500).json({ error: 'Failed to update area status' });
    }
});
// Admin: Update fox team location
router.post('/areas/:area_id/location', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { area_id } = req.params;
        const { lat, lng, source = 'manual' } = req.body;
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Latitude and longitude required' });
        }
        const area = await (0, database_1.db)('areas').where('id', area_id).first();
        if (!area) {
            return res.status(404).json({ error: 'Area not found' });
        }
        // Update area with latest location
        await (0, database_1.db)('areas')
            .where('id', area_id)
            .update({
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            last_seen: new Date(),
            updated_at: new Date()
        });
        // Add location to history
        await (0, database_1.db)('area_locations').insert({
            area_id: parseInt(area_id),
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            source,
            recorded_at: new Date()
        });
        const updatedArea = await (0, database_1.db)('areas').where('id', area_id).first();
        // Emit real-time location update
        try {
            const io = (0, socketManager_1.getSocketIO)();
            io.emit('fox-location-update', {
                area_id: parseInt(area_id),
                name: area.name,
                fox_team_name: area.fox_team_name,
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                last_seen: new Date(),
                source
            });
        }
        catch (socketError) {
            console.error('Socket emission error:', socketError);
        }
        res.json(updatedArea);
    }
    catch (error) {
        console.error('Update area location error:', error);
        res.status(500).json({ error: 'Failed to update area location' });
    }
});
// Get fox team location history
router.get('/areas/:area_id/locations', auth_1.authenticateToken, async (req, res) => {
    try {
        const { area_id } = req.params;
        const { limit = 50 } = req.query;
        const locations = await (0, database_1.db)('area_locations')
            .where('area_id', area_id)
            .orderBy('recorded_at', 'desc')
            .limit(parseInt(limit));
        res.json(locations);
    }
    catch (error) {
        console.error('Get area locations error:', error);
        res.status(500).json({ error: 'Failed to get area locations' });
    }
});
// Get fox status history
router.get('/fox-status-history', auth_1.authenticateToken, async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        // Get recent area updates (status changes)
        const statusHistory = await (0, database_1.db)('areas')
            .select('id', 'name', 'fox_team_name', 'status', 'updated_at', 'last_seen')
            .orderBy('updated_at', 'desc')
            .limit(parseInt(limit));
        res.json(statusHistory);
    }
    catch (error) {
        console.error('Get fox status history error:', error);
        res.status(500).json({ error: 'Failed to get fox status history' });
    }
});
// Admin: Bulk update multiple fox areas
router.post('/areas/bulk-update', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { updates } = req.body;
        if (!Array.isArray(updates)) {
            return res.status(400).json({ error: 'Updates must be an array' });
        }
        const results = [];
        for (const update of updates) {
            const { area_id, status, lat, lng, reason } = update;
            if (status) {
                await (0, database_1.db)('areas')
                    .where('id', area_id)
                    .update({
                    status,
                    updated_at: new Date()
                });
            }
            if (lat && lng) {
                await (0, database_1.db)('areas')
                    .where('id', area_id)
                    .update({
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                    last_seen: new Date(),
                    updated_at: new Date()
                });
                await (0, database_1.db)('area_locations').insert({
                    area_id: parseInt(area_id),
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                    source: 'bulk_update',
                    recorded_at: new Date()
                });
            }
            const area = await (0, database_1.db)('areas').where('id', area_id).first();
            results.push(area);
        }
        // Emit bulk update notification
        try {
            const io = (0, socketManager_1.getSocketIO)();
            io.emit('fox-bulk-update', {
                updated_areas: results,
                timestamp: new Date()
            });
        }
        catch (socketError) {
            console.error('Socket emission error:', socketError);
        }
        res.json({
            message: 'Bulk update completed',
            updated_count: results.length,
            areas: results
        });
    }
    catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({ error: 'Failed to perform bulk update' });
    }
});
// SUBSCRIPTION MANAGEMENT ENDPOINTS
// Admin: Assign subscription to fox team
router.post('/subscriptions/:subscription_id/assign-fox', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { subscription_id } = req.params;
        const { fox_team_name, lat, lng } = req.body;
        if (!fox_team_name) {
            return res.status(400).json({ error: 'Fox team name is required' });
        }
        // Validate fox team exists
        const foxArea = await (0, database_1.db)('areas').where('name', fox_team_name).first();
        if (!foxArea) {
            return res.status(400).json({ error: 'Fox team not found' });
        }
        // Update subscription with fox team assignment and coordinates
        await (0, database_1.db)('subscriptions')
            .where('id', subscription_id)
            .where('tenant_id', req.user.tenant_id)
            .update({
            fox_team_name,
            lat: lat ? parseFloat(lat) : null,
            lng: lng ? parseFloat(lng) : null,
            updated_at: new Date()
        });
        const subscription = await (0, database_1.db)('subscriptions')
            .where('id', subscription_id)
            .where('tenant_id', req.user.tenant_id)
            .first();
        res.json({
            message: 'Subscription assigned to fox team',
            subscription
        });
    }
    catch (error) {
        console.error('Assign fox team error:', error);
        res.status(500).json({ error: 'Failed to assign fox team' });
    }
});
// Admin: Record fox visit to subscription/group
router.post('/subscriptions/:subscription_id/visit', auth_1.authenticateToken, async (req, res) => {
    try {
        const { subscription_id } = req.params;
        const { fox_team_name, visit_lat, visit_lng, notes } = req.body;
        if (!fox_team_name || !visit_lat || !visit_lng) {
            return res.status(400).json({ error: 'Fox team name and visit coordinates are required' });
        }
        // Get fox area for the team
        const foxArea = await (0, database_1.db)('areas')
            .where('name', fox_team_name)
            .where('tenant_id', req.user.tenant_id)
            .first();
        if (!foxArea) {
            return res.status(400).json({ error: 'Fox team not found' });
        }
        // Verify subscription exists
        const subscription = await (0, database_1.db)('subscriptions')
            .where('id', subscription_id)
            .where('tenant_id', req.user.tenant_id)
            .first();
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        // Record the visit (will replace existing visit from same fox team)
        await (0, database_1.db)('subscription_visits')
            .insert({
            subscription_id: parseInt(subscription_id),
            area_id: foxArea.id,
            fox_team_name,
            visit_lat: parseFloat(visit_lat),
            visit_lng: parseFloat(visit_lng),
            user_id: req.user.id,
            notes,
            tenant_id: req.user.tenant_id,
            created_at: new Date(),
            updated_at: new Date()
        })
            .onConflict(['subscription_id', 'area_id', 'tenant_id'])
            .merge({
            visit_lat: parseFloat(visit_lat),
            visit_lng: parseFloat(visit_lng),
            user_id: req.user.id,
            notes,
            updated_at: new Date()
        });
        // Get updated subscription with visit info
        const subscriptionWithVisits = await (0, database_1.db)('subscriptions')
            .select('subscriptions.*')
            .where('subscriptions.id', subscription_id)
            .where('subscriptions.tenant_id', req.user.tenant_id)
            .first();
        // Get all visits for this subscription
        const visits = await (0, database_1.db)('subscription_visits')
            .where('subscription_id', subscription_id)
            .where('tenant_id', req.user.tenant_id)
            .orderBy('created_at', 'desc');
        res.json({
            message: 'Visit recorded successfully',
            subscription: {
                ...subscriptionWithVisits,
                visits,
                visited_by_foxes: visits.map(v => v.fox_team_name)
            }
        });
    }
    catch (error) {
        console.error('Record visit error:', error);
        res.status(500).json({ error: 'Failed to record visit' });
    }
});
// Get subscription with visit history
router.get('/subscriptions/:subscription_id/visits', auth_1.authenticateToken, async (req, res) => {
    try {
        const { subscription_id } = req.params;
        const subscription = await (0, database_1.db)('subscriptions')
            .where('id', subscription_id)
            .where('tenant_id', req.user.tenant_id)
            .first();
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        const visits = await (0, database_1.db)('subscription_visits')
            .select('subscription_visits.*', 'users.username', 'users.first_name', 'users.last_name')
            .leftJoin('users', 'subscription_visits.user_id', 'users.id')
            .where('subscription_visits.subscription_id', subscription_id)
            .where('subscription_visits.tenant_id', req.user.tenant_id)
            .orderBy('subscription_visits.created_at', 'desc');
        res.json({
            subscription,
            visits,
            visited_by_foxes: visits.map(v => v.fox_team_name)
        });
    }
    catch (error) {
        console.error('Get subscription visits error:', error);
        res.status(500).json({ error: 'Failed to get subscription visits' });
    }
});
// Update subscriptions endpoint to include visit data
router.get('/subscriptions-with-visits', auth_1.authenticateToken, async (req, res) => {
    try {
        console.log('📊 Fetching subscriptions for tenant:', req.user.tenant_id);
        res.setHeader('Cache-Control', 'private, max-age=30');
        const subscriptions = await (0, database_1.db)('subscriptions')
            .where('tenant_id', req.user.tenant_id)
            .where('is_participating', true)
            .orderBy('team_name');
        console.log('📊 Found subscriptions:', subscriptions.length);
        // Get all visits for these subscriptions
        const subscriptionIds = subscriptions.map(sub => sub.id);
        const visits = await (0, database_1.db)('subscription_visits')
            .whereIn('subscription_id', subscriptionIds)
            .where('tenant_id', req.user.tenant_id);
        // Group visits by subscription
        const visitsBySubscription = visits.reduce((acc, visit) => {
            if (!acc[visit.subscription_id])
                acc[visit.subscription_id] = [];
            acc[visit.subscription_id].push(visit);
            return acc;
        }, {});
        // Add visit data to subscriptions
        const subscriptionsWithVisits = subscriptions.map(subscription => ({
            ...subscription,
            visits: visitsBySubscription[subscription.id] || [],
            visited_by_foxes: visitsBySubscription[subscription.id]?.map((v) => v.fox_team_name) || []
        }));
        res.json(subscriptionsWithVisits);
    }
    catch (error) {
        console.error('Get subscriptions with visits error:', error);
        res.status(500).json({ error: 'Failed to get subscriptions with visits' });
    }
});
exports.default = router;
//# sourceMappingURL=jotihunt.js.map