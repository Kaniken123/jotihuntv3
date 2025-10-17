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
    console.log('🔗 Calling subscriptions endpoint...');
    try {
      const response = await api.get('/jotihunt/subscriptions-with-visits');
      console.log('✅ Subscriptions response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Subscriptions error, trying fallback...', error);
      // Fallback to basic endpoint
      try {
        const fallbackResponse = await api.get('/jotihunt/subscriptions');
        console.log('✅ Fallback subscriptions response:', fallbackResponse.data);
        return fallbackResponse.data;
      } catch (fallbackError) {
        console.error('❌ Fallback subscriptions error:', fallbackError);
        throw fallbackError;
      }
    }
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

  async getFoxRoute(areaId: number, hours: number = 24, limit: number = 100) {
    const response = await api.get(`/jotihunt/areas/${areaId}/route?hours=${hours}&limit=${limit}`);
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

  // Admin route tracking functions
  async getUsersForRouteTracking() {
    const response = await api.get('/locations/users');
    return response.data;
  },

  async getUserRoute(userId: number, hours: number = 24, limit: number = 500) {
    const response = await api.get(`/locations/route/${userId}?hours=${hours}&limit=${limit}`);
    return response.data;
  },

  // Hint solution functions
  async submitHintSolution(articleId: number, solution: string, foxCoordinates?: any) {
    const response = await api.post('/hints/solutions', {
      article_id: articleId,
      solution,
      fox_coordinates: foxCoordinates
    });
    return response.data;
  },

  async getHintSolutions() {
    const response = await api.get('/hints/solutions');
    return response.data;
  },

  async getAllHintSolutions() {
    const response = await api.get('/hints/solutions/all');
    return response.data;
  },

  async updateHintSolution(solutionId: number, data: { is_correct: boolean, fox_team?: string, reveals_fox_location?: boolean }) {
    const response = await api.patch(`/hints/solutions/${solutionId}`, data);
    return response.data;
  },

  // Subscription management functions
  async recordFoxVisit(subscriptionId: number, foxTeamName: string, visitLat: number, visitLng: number, notes?: string) {
    const response = await api.post(`/jotihunt/subscriptions/${subscriptionId}/visit`, {
      fox_team_name: foxTeamName,
      visit_lat: visitLat,
      visit_lng: visitLng,
      notes
    });
    return response.data;
  },

  async getSubscriptionVisits(subscriptionId: number) {
    const response = await api.get(`/jotihunt/subscriptions/${subscriptionId}/visits`);
    return response.data;
  },

  async updateSubscription(subscriptionId: number, data: { area?: string }) {
    const response = await api.patch(`/jotihunt/subscriptions/${subscriptionId}`, data);
    return response.data;
  },

  // Admin: Reset all fox locations
  async resetAllFoxLocations() {
    const response = await api.post('/jotihunt/areas/reset-locations');
    return response.data;
  },
};