import { api } from './authService';
import { Area, Article, UserLocation, Hunt } from '../types';

export const gameService = {
  async getAreas(): Promise<Area[]> {
    const response = await api.get('/jotihunt/areas');
    return response.data;
  },

  async getArticles(type?: string, area?: string): Promise<Article[]> {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (area) params.append('area', area);
    
    const response = await api.get(`/jotihunt/articles?${params.toString()}`);
    return response.data;
  },

  async getSubscriptions() {
    const response = await api.get('/jotihunt/subscriptions');
    return response.data;
  },

  async getStatus() {
    const response = await api.get('/jotihunt/status');
    return response.data;
  },

  async syncData() {
    const response = await api.post('/jotihunt/sync');
    return response.data;
  },

  async getUserLocations(teamOnly = false): Promise<UserLocation[]> {
    const response = await api.get(`/locations/latest?team_only=${teamOnly}`);
    return response.data;
  },

  async updateUserLocation(lat: number, lng: number, accuracy?: number) {
    const response = await api.post('/locations/update', { lat, lng, accuracy });
    return response.data;
  },

  async getLocationSettings() {
    const response = await api.get('/locations/settings');
    return response.data;
  },

  async updateLocationSettings(settings: any) {
    const response = await api.post('/locations/settings', settings);
    return response.data;
  },

  async submitHunt(huntData: {
    fox_area: string;
    hunt_lat: number;
    hunt_lng: number;
    photo_url: string;
  }): Promise<Hunt> {
    const response = await api.post('/hunts', huntData);
    return response.data;
  },

  async getHunts(): Promise<Hunt[]> {
    const response = await api.get('/hunts');
    return response.data;
  },

  async updateFoxLocation(areaId: number, lat: number, lng: number, source: string = 'manual') {
    const response = await api.post(`/jotihunt/areas/${areaId}/location`, { lat, lng, source });
    return response.data;
  },

  async getFoxLocationHistory(areaId: number, limit: number = 50) {
    const response = await api.get(`/jotihunt/areas/${areaId}/locations?limit=${limit}`);
    return response.data;
  },

  async getArticle(id: number): Promise<Article> {
    const response = await api.get(`/jotihunt/articles/${id}`);
    return response.data;
  },

  async markArticleAsRead(id: number) {
    const response = await api.post(`/jotihunt/articles/${id}/read`);
    return response.data;
  },

  async toggleAssignmentCompletion(id: number, isCompleted: boolean, completionNotes?: string) {
    const response = await api.post(`/jotihunt/articles/${id}/complete`, {
      is_completed: isCompleted,
      completion_notes: completionNotes
    });
    return response.data;
  },

  async deleteUser(userId: number) {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },
};