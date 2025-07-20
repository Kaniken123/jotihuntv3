"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JotihuntApiService = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = require("../utils/database");
const JOTIHUNT_API_BASE = 'https://jotihunt.nl/api/2.0';
class JotihuntApiService {
    static async fetchFromApi(endpoint) {
        try {
            // Add delay between API calls to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between calls
            const response = await axios_1.default.get(`${JOTIHUNT_API_BASE}${endpoint}`, {
                timeout: 15000, // Increased timeout
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'JotihuntV2-App/1.0'
                }
            });
            return response.data;
        }
        catch (error) {
            // Handle rate limiting specifically
            if (error.response?.status === 429) {
                console.error(`⚠️  Rate limit exceeded for ${endpoint}. Waiting before retry...`);
                throw new Error(`Rate limit exceeded for ${endpoint}. Please reduce API frequency.`);
            }
            console.error(`Jotihunt API error for ${endpoint}:`, error.message);
            throw new Error(`Failed to fetch ${endpoint}: ${error.message}`);
        }
    }
    static async getSubscriptions() {
        const response = await this.fetchFromApi('/subscriptions');
        return response.data;
    }
    static async getAreas() {
        const response = await this.fetchFromApi('/areas');
        return response.data;
    }
    static async getArticles() {
        const response = await this.fetchFromApi('/articles');
        return response.data;
    }
    // Sync external data with local database
    static async syncSubscriptions() {
        try {
            const externalSubscriptions = await this.getSubscriptions();
            let synced = 0;
            let errors = 0;
            for (const subscription of externalSubscriptions) {
                try {
                    await (0, database_1.db)('subscriptions')
                        .insert({
                        external_id: subscription.id,
                        team_name: subscription.name || subscription.team_name,
                        is_participating: subscription.is_participating,
                        synced_at: new Date(),
                        updated_at: new Date()
                    })
                        .onConflict('external_id')
                        .merge({
                        team_name: subscription.name || subscription.team_name,
                        is_participating: subscription.is_participating,
                        synced_at: new Date(),
                        updated_at: new Date()
                    });
                    synced++;
                }
                catch (error) {
                    console.error('Error syncing subscription:', subscription.id, error);
                    errors++;
                }
            }
            // Update last sync timestamp
            await (0, database_1.db)('api_cache')
                .insert({
                cache_key: 'subscriptions_last_sync',
                data: JSON.stringify({ count: synced, errors }),
                last_sync: new Date()
            })
                .onConflict('cache_key')
                .merge({
                data: JSON.stringify({ count: synced, errors }),
                last_sync: new Date()
            });
            return { synced, errors };
        }
        catch (error) {
            console.error('Subscription sync error:', error);
            throw error;
        }
    }
    static async syncAreas() {
        try {
            const externalAreas = await this.getAreas();
            let synced = 0;
            let errors = 0;
            for (const area of externalAreas) {
                try {
                    await (0, database_1.db)('areas')
                        .where('name', area.name)
                        .update({
                        status: area.status,
                        lat: area.lat,
                        lng: area.lng,
                        last_seen: area.last_seen ? new Date(area.last_seen) : null,
                        synced_at: new Date(),
                        updated_at: new Date()
                    });
                    // If no rows were updated, the area doesn't exist locally
                    const result = await (0, database_1.db)('areas').where('name', area.name).first();
                    if (!result) {
                        await (0, database_1.db)('areas').insert({
                            external_id: area.id,
                            name: area.name,
                            fox_team_name: area.fox_team_name,
                            status: area.status,
                            lat: area.lat,
                            lng: area.lng,
                            last_seen: area.last_seen ? new Date(area.last_seen) : null,
                            points: 0, // Default points
                            synced_at: new Date(),
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                    }
                    synced++;
                }
                catch (error) {
                    console.error('Error syncing area:', area.id, error);
                    errors++;
                }
            }
            await (0, database_1.db)('api_cache')
                .insert({
                cache_key: 'areas_last_sync',
                data: JSON.stringify({ count: synced, errors }),
                last_sync: new Date()
            })
                .onConflict('cache_key')
                .merge({
                data: JSON.stringify({ count: synced, errors }),
                last_sync: new Date()
            });
            return { synced, errors };
        }
        catch (error) {
            console.error('Areas sync error:', error);
            throw error;
        }
    }
    static async syncArticles() {
        try {
            const externalArticles = await this.getArticles();
            let synced = 0;
            let errors = 0;
            for (const article of externalArticles) {
                try {
                    await (0, database_1.db)('articles')
                        .insert({
                        external_id: article.id,
                        title: article.title,
                        content: article.message.content,
                        type: article.type,
                        area: article.area,
                        published_at: new Date(article.publish_at),
                        is_active: true,
                        synced_at: new Date(),
                        created_at: new Date(),
                        updated_at: new Date()
                    })
                        .onConflict('external_id')
                        .merge({
                        title: article.title,
                        content: article.message.content,
                        type: article.type,
                        area: article.area,
                        published_at: new Date(article.publish_at),
                        synced_at: new Date(),
                        updated_at: new Date()
                    });
                    synced++;
                }
                catch (error) {
                    console.error('Error syncing article:', article.id, error);
                    errors++;
                }
            }
            await (0, database_1.db)('api_cache')
                .insert({
                cache_key: 'articles_last_sync',
                data: JSON.stringify({ count: synced, errors }),
                last_sync: new Date()
            })
                .onConflict('cache_key')
                .merge({
                data: JSON.stringify({ count: synced, errors }),
                last_sync: new Date()
            });
            return { synced, errors };
        }
        catch (error) {
            console.error('Articles sync error:', error);
            throw error;
        }
    }
    // Sync all external data
    static async syncAll() {
        const [subscriptions, areas, articles] = await Promise.allSettled([
            this.syncSubscriptions(),
            this.syncAreas(),
            this.syncArticles()
        ]);
        return {
            subscriptions: subscriptions.status === 'fulfilled' ? subscriptions.value : { synced: 0, errors: 1 },
            areas: areas.status === 'fulfilled' ? areas.value : { synced: 0, errors: 1 },
            articles: articles.status === 'fulfilled' ? articles.value : { synced: 0, errors: 1 }
        };
    }
    // Get sync status for all endpoints
    static async getSyncStatus() {
        const [subscriptionsSync, areasSync, articlesSync] = await Promise.all([
            (0, database_1.db)('api_cache').where('cache_key', 'subscriptions_last_sync').first(),
            (0, database_1.db)('api_cache').where('cache_key', 'areas_last_sync').first(),
            (0, database_1.db)('api_cache').where('cache_key', 'articles_last_sync').first()
        ]);
        return {
            subscriptions: subscriptionsSync ? {
                last_sync: subscriptionsSync.last_sync,
                data: JSON.parse(subscriptionsSync.data || '{}')
            } : null,
            areas: areasSync ? {
                last_sync: areasSync.last_sync,
                data: JSON.parse(areasSync.data || '{}')
            } : null,
            articles: articlesSync ? {
                last_sync: articlesSync.last_sync,
                data: JSON.parse(articlesSync.data || '{}')
            } : null
        };
    }
}
exports.JotihuntApiService = JotihuntApiService;
//# sourceMappingURL=jotihuntApi.js.map