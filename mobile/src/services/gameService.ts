import { api } from './api';
import {
  Area,
  Article,
  Hunt,
  UserLocation,
  LocationSettings,
  FoxRoute,
  Subscription,
  TeamMessage,
} from '../types';

export const gameService = {
  // Areas
  async getAreas(): Promise<Area[]> {
    const response = await api.get('/jotihunt/areas');
    return response.data;
  },

  async getAreaRoute(areaId: number, hours?: number): Promise<FoxRoute> {
    const params = hours ? { hours } : {};
    const response = await api.get(`/jotihunt/areas/${areaId}/route`, { params });
    return response.data;
  },

  // Articles/Hints
  async getArticles(type?: string): Promise<Article[]> {
    const params = type ? { type } : {};
    const response = await api.get('/jotihunt/articles', { params });
    return response.data;
  },

  async getArticle(id: number): Promise<Article> {
    const response = await api.get(`/jotihunt/articles/${id}`);
    return response.data;
  },

  async markArticleAsRead(id: number): Promise<void> {
    await api.post(`/hints/${id}/read`);
  },

  async markArticleAsCompleted(id: number, notes?: string): Promise<void> {
    await api.post(`/hints/${id}/complete`, { notes });
  },

  // Hunts
  async getMyHunts(): Promise<Hunt[]> {
    const response = await api.get('/hunts/my-hunts');
    return response.data;
  },

  async getHuntCooldowns(): Promise<any[]> {
    const response = await api.get('/hunts/cooldowns');
    return response.data;
  },

  async submitHunt(formData: FormData): Promise<Hunt> {
    const response = await api.post('/hunts/submit', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getHuntStats(teamId?: number): Promise<any> {
    const params = teamId ? { team_id: teamId } : {};
    const response = await api.get('/hunts/stats', { params });
    return response.data;
  },

  // Locations
  async getLocationSettings(): Promise<LocationSettings> {
    const response = await api.get('/locations/settings');
    return response.data;
  },

  async updateLocationSettings(settings: Partial<LocationSettings>): Promise<LocationSettings> {
    const response = await api.post('/locations/settings', settings);
    return response.data;
  },

  async updateLocation(lat: number, lng: number, accuracy?: number): Promise<void> {
    await api.post('/locations/update', { lat, lng, accuracy });
  },

  async getLatestLocations(teamOnly?: boolean): Promise<UserLocation[]> {
    const params = teamOnly ? { team_only: 'true' } : {};
    const response = await api.get('/locations/latest', { params });
    return response.data;
  },

  async getLocationHistory(userId: number, limit?: number): Promise<UserLocation[]> {
    const params = limit ? { limit } : {};
    const response = await api.get(`/locations/history/${userId}`, { params });
    return response.data;
  },

  async getUserRoute(userId: number, hours?: number): Promise<any> {
    const params = hours ? { hours } : {};
    const response = await api.get(`/locations/route/${userId}`, { params });
    return response.data;
  },

  // Subscriptions
  async getSubscriptions(): Promise<Subscription[]> {
    const response = await api.get('/jotihunt/subscriptions');
    return response.data;
  },

  async updateSubscription(id: number, data: Partial<Subscription>): Promise<Subscription> {
    const response = await api.put(`/jotihunt/subscriptions/${id}`, data);
    return response.data;
  },

  // Chat
  async getTeamMessages(teamId: number): Promise<TeamMessage[]> {
    const response = await api.get(`/chat/team/${teamId}/messages`);
    return response.data;
  },

  async sendTeamMessage(teamId: number, message: string, attachment?: FormData): Promise<TeamMessage> {
    if (attachment) {
      attachment.append('message', message);
      const response = await api.post(`/chat/team/${teamId}/messages`, attachment, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    }
    
    const response = await api.post(`/chat/team/${teamId}/messages`, { message });
    return response.data;
  },

  // Rules
  async getRules(): Promise<string> {
    const response = await api.get('/rules');
    return response.data;
  },

  // Sync
  async syncData(): Promise<any> {
    const response = await api.post('/jotihunt/sync');
    return response.data;
  },

  async getApiStatus(): Promise<any> {
    const response = await api.get('/jotihunt/status');
    return response.data;
  },
};

export default gameService;
