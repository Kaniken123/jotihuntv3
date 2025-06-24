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
  team_name?: string;
  is_participating: boolean;
  // Add other fields as needed based on actual API response
}

interface JotihuntArea {
  id: number;
  name: string;
  fox_team_name?: string;
  status: 'active' | 'inactive' | 'hunted';
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
      const response = await axios.get(`${JOTIHUNT_API_BASE}${endpoint}`, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'JotihuntV2-App/1.0'
        }
      });
      return response.data;
    } catch (error: any) {
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
      const externalSubscriptions = await this.getSubscriptions();
      let synced = 0;
      let errors = 0;

      for (const subscription of externalSubscriptions) {
        try {
          await db('subscriptions')
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

  static async syncAreas(): Promise<{ synced: number; errors: number }> {
    try {
      const externalAreas = await this.getAreas();
      let synced = 0;
      let errors = 0;

      for (const area of externalAreas) {
        try {
          await db('areas')
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
          const result = await db('areas').where('name', area.name).first();
          if (!result) {
            await db('areas').insert({
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
      const externalArticles = await this.getArticles();
      let synced = 0;
      let errors = 0;

      for (const article of externalArticles) {
        try {
          await db('articles')
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