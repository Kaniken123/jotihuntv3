import axios from 'axios';
import { db } from '../utils/database';

const JOTIHUNT_API_BASE = 'https://jotihunt.nl/api/2.0';

interface JotihuntApiResponse<T> {
  data: T[];
  links?: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta?: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  };
}

interface JotihuntSubscription {
  id: number;
  name: string;
  accomodation?: string;
  street?: string;
  housenumber?: number;
  housenumber_addition?: string;
  postcode?: string;
  city?: string;
  lat: string;
  long: string;
  team_name?: string;
  is_participating?: boolean;
  area?: string; // Deelgebied: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel
}

interface JotihuntArea {
  id: number;
  name: string;
  fox_team_name?: string;
  status: string; // API can return 'green', 'orange', 'red' or other values
  lat?: number;
  lng?: number;
  last_seen?: string;
  // Add other fields as needed
}

interface JotihuntArticle {
  id: number;
  title: string;
  type: 'hint' | 'assignment' | 'news';
  publish_at: string;
  message: {
    content: string;
  };
  area?: string;
}

export class JotihuntApiService {
  private static async fetchFromApi<T>(endpoint: string): Promise<JotihuntApiResponse<T>> {
    try {
      // Add delay between API calls to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between calls
      
      const response = await axios.get(`${JOTIHUNT_API_BASE}${endpoint}`, {
        timeout: 15000, // Increased timeout
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'JotihuntV2-App/1.0'
        }
      });
      return response.data;
    } catch (error: any) {
      // Handle rate limiting specifically
      if (error.response?.status === 429) {
        console.error(`⚠️  Rate limit exceeded for ${endpoint}. Waiting before retry...`);
        throw new Error(`Rate limit exceeded for ${endpoint}. Please reduce API frequency.`);
      }
      
      console.error(`Jotihunt API error for ${endpoint}:`, error.message);
      throw new Error(`Failed to fetch ${endpoint}: ${error.message}`);
    }
  }

  static async getSubscriptions(): Promise<JotihuntSubscription[]> {
    const response = await this.fetchFromApi<JotihuntSubscription>('/subscriptions');
    return response.data;
  }

  static async getAreas(): Promise<JotihuntArea[]> {
    const response = await this.fetchFromApi<JotihuntArea>('/areas');
    return response.data;
  }

  static async getArticles(): Promise<JotihuntArticle[]> {
    const response = await this.fetchFromApi<JotihuntArticle>('/articles');
    return response.data;
  }

  // Sync external data with local database
  static async syncSubscriptions(): Promise<{ synced: number; errors: number }> {
    try {
      console.log('🔄 Starting subscriptions sync...');
      const externalSubscriptions = await this.getSubscriptions();
      
      // Get all active tenants
      const tenants = await db('tenants').where('is_active', true);
      
      let synced = 0;
      let errors = 0;

      for (const subscription of externalSubscriptions) {
        try {
          // Sync to all tenants
          for (const tenant of tenants) {
            // Convert lat/lng from strings to numbers, skip invalid coordinates
            let lat = null;
            let lng = null;
            
            if (subscription.lat && subscription.long && 
                subscription.lat !== 'lat' && subscription.long !== 'long') {
              const parsedLat = parseFloat(subscription.lat);
              const parsedLng = parseFloat(subscription.long);
              
              // Validate coordinates are within reasonable bounds for Netherlands
              if (!isNaN(parsedLat) && !isNaN(parsedLng) && 
                  parsedLat >= 50.0 && parsedLat <= 54.0 && 
                  parsedLng >= 3.0 && parsedLng <= 8.0) {
                lat = parsedLat;
                lng = parsedLng;
              }
            }
            
            await db('subscriptions')
              .insert({
                external_id: subscription.id,
                team_name: subscription.name || subscription.team_name,
                is_participating: subscription.is_participating ?? true, // Default to true
                lat,
                lng,
                area: subscription.area || null, // Deelgebied from API
                accomodation: subscription.accomodation,
                street: subscription.street,
                housenumber: subscription.housenumber,
                housenumber_addition: subscription.housenumber_addition,
                postcode: subscription.postcode,
                city: subscription.city,
                tenant_id: tenant.id,
                synced_at: new Date(),
                updated_at: new Date()
              })
              .onConflict(['external_id', 'tenant_id'])
              .merge({
                team_name: subscription.name || subscription.team_name,
                is_participating: subscription.is_participating ?? true,
                lat,
                lng,
                area: subscription.area || null, // Update deelgebied on sync
                accomodation: subscription.accomodation,
                street: subscription.street,
                housenumber: subscription.housenumber,
                housenumber_addition: subscription.housenumber_addition,
                postcode: subscription.postcode,
                city: subscription.city,
                synced_at: new Date(),
                updated_at: new Date()
              });
          }
          synced++;
        } catch (error) {
          console.error('Error syncing subscription:', subscription.id, error);
          errors++;
        }
      }

      // Update last sync timestamp
      await db('api_cache')
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
    } catch (error) {
      console.error('Subscription sync error:', error);
      throw error;
    }
  }

  // Map API status values to database status values
  private static mapStatusToDb(apiStatus: string): 'active' | 'inactive' | 'hunted' {
    const statusMap: { [key: string]: 'active' | 'inactive' | 'hunted' } = {
      'green': 'active',
      'orange': 'active',  // Orange (onderweg) means still active/huntable
      'red': 'inactive'
    };

    return statusMap[apiStatus] || 'inactive';
  }

  static async syncAreas(): Promise<{ synced: number; errors: number }> {
    try {
      console.log('🔄 Starting areas sync...');
      const externalAreas = await this.getAreas();

      // Get all active tenants
      const tenants = await db('tenants').where('is_active', true);

      let synced = 0;
      let errors = 0;

      for (const area of externalAreas) {
        try {
          // Map API status to database status
          const dbStatus = this.mapStatusToDb(area.status);

          // Sync to all tenants
          for (const tenant of tenants) {
            // Check if area exists for this tenant
            const localArea = await db('areas')
              .where('name', area.name)
              .where('tenant_id', tenant.id)
              .first();

            if (localArea) {
              // Check if status changed
              const statusChanged = localArea.status !== dbStatus;

              // If status changed, close the previous status period
              if (statusChanged) {
                const now = new Date();

                // Get the current open status record (if any)
                const currentStatusRecord = await db('fox_status_history')
                  .where('area_id', localArea.id)
                  .whereNull('ended_at')
                  .orderBy('started_at', 'desc')
                  .first();

                if (currentStatusRecord) {
                  // Close the previous status record
                  const startedAt = new Date(currentStatusRecord.started_at);
                  const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

                  await db('fox_status_history')
                    .where('id', currentStatusRecord.id)
                    .update({
                      ended_at: now,
                      duration_seconds: durationSeconds
                    });
                }

                // Create new status record
                await db('fox_status_history').insert({
                  area_id: localArea.id,
                  api_status: area.status,
                  db_status: dbStatus,
                  fox_team_name: area.fox_team_name,
                  lat: area.lat,
                  lng: area.lng,
                  started_at: now,
                  tenant_id: tenant.id
                });
              }

              // Update existing area
              await db('areas')
                .where('id', localArea.id)
                .update({
                  fox_team_name: area.fox_team_name,
                  status: dbStatus,
                  lat: area.lat,
                  lng: area.lng,
                  last_seen: area.last_seen ? new Date(area.last_seen) : null,
                  synced_at: new Date(),
                  updated_at: new Date()
                });

              // Add location history if coordinates changed
              if (area.lat && area.lng &&
                  (localArea.lat !== area.lat || localArea.lng !== area.lng)) {
                await db('area_locations').insert({
                  area_id: localArea.id,
                  lat: area.lat,
                  lng: area.lng,
                  recorded_at: area.last_seen ? new Date(area.last_seen) : new Date(),
                  source: 'api'
                });
              }
            } else {
              // Create new area for this tenant
              const [newAreaId] = await db('areas').insert({
                external_id: area.id,
                name: area.name,
                fox_team_name: area.fox_team_name,
                status: dbStatus,
                lat: area.lat,
                lng: area.lng,
                last_seen: area.last_seen ? new Date(area.last_seen) : null,
                points: 0, // Default points
                tenant_id: tenant.id,
                synced_at: new Date(),
                created_at: new Date(),
                updated_at: new Date()
              }).returning('id');

              // Create initial status history record for new area
              await db('fox_status_history').insert({
                area_id: newAreaId,
                api_status: area.status,
                db_status: dbStatus,
                fox_team_name: area.fox_team_name,
                lat: area.lat,
                lng: area.lng,
                started_at: new Date(),
                tenant_id: tenant.id
              });

              // Store initial location in history if coordinates exist
              if (area.lat && area.lng) {
                await db('area_locations').insert({
                  area_id: newAreaId,
                  lat: area.lat,
                  lng: area.lng,
                  recorded_at: area.last_seen ? new Date(area.last_seen) : new Date(),
                  source: 'api'
                });
              }
            }
          }
          synced++;
        } catch (error) {
          console.error('Error syncing area:', area.id, error);
          errors++;
        }
      }

      await db('api_cache')
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
    } catch (error) {
      console.error('Areas sync error:', error);
      throw error;
    }
  }

  static async syncArticles(): Promise<{ synced: number; errors: number }> {
    try {
      console.log('🔄 Starting articles sync...');
      const externalArticles = await this.getArticles();
      
      // Get all active tenants
      const tenants = await db('tenants').where('is_active', true);
      
      let synced = 0;
      let errors = 0;

      for (const article of externalArticles) {
        try {
          // Sync to all tenants
          for (const tenant of tenants) {
            await db('articles')
              .insert({
                external_id: article.id,
                title: article.title,
                content: article.message.content,
                type: article.type,
                area: article.area,
                published_at: new Date(article.publish_at),
                is_active: true,
                tenant_id: tenant.id,
                synced_at: new Date(),
                created_at: new Date(),
                updated_at: new Date()
              })
              .onConflict(['external_id', 'tenant_id'])
              .merge({
                title: article.title,
                content: article.message.content,
                type: article.type,
                area: article.area,
                published_at: new Date(article.publish_at),
                synced_at: new Date(),
                updated_at: new Date()
              });
          }
          synced++;
        } catch (error) {
          console.error('Error syncing article:', article.id, error);
          errors++;
        }
      }

      await db('api_cache')
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
    } catch (error) {
      console.error('Articles sync error:', error);
      throw error;
    }
  }

  // Sync all external data
  static async syncAll(): Promise<{
    subscriptions: { synced: number; errors: number };
    areas: { synced: number; errors: number };
    articles: { synced: number; errors: number };
  }> {
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
      db('api_cache').where('cache_key', 'subscriptions_last_sync').first(),
      db('api_cache').where('cache_key', 'areas_last_sync').first(),
      db('api_cache').where('cache_key', 'articles_last_sync').first()
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