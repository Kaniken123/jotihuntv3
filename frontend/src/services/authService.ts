import axios from 'axios';
import { User, Team, Tenant } from '../types';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Use replace instead of href assignment to prevent potential navigation issues
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async login(username: string, password: string, selected_tenant_id?: number): Promise<{ 
    user: User; 
    team?: Team; 
    token: string;
    requires_tenant_selection?: boolean;
    tenant_options?: Array<{id: number, name: string, slug: string, user_id: number}>;
  }> {
    const response = await api.post('/auth/login', { username, password, selected_tenant_id });
    return response.data;
  },

  async register(userData: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    tenant_slug?: string;
  }): Promise<{ user: User }> {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  async getPublicTenants(): Promise<Array<{ id: number; name: string; slug: string }>> {
    const response = await api.get('/auth/tenants/public');
    return response.data;
  },

  async getCurrentUser(): Promise<{ user: User; team?: Team }> {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async switchTenant(tenantId: number): Promise<{ tenant: Tenant; token: string }> {
    const response = await api.post('/auth/switch-tenant', { tenant_id: tenantId });
    return response.data;
  },

  async getTenants(): Promise<Tenant[]> {
    const response = await api.get('/auth/tenants');
    return response.data;
  },

  async createTenant(tenantData: {
    name: string;
    slug: string;
    description?: string;
  }): Promise<Tenant> {
    const response = await api.post('/auth/tenants', tenantData);
    return response.data;
  },

  async updateTenant(tenantId: number, tenantData: {
    name: string;
    slug: string;
    description?: string;
  }): Promise<Tenant> {
    const response = await api.put(`/auth/tenants/${tenantId}`, tenantData);
    return response.data;
  },
};

export { api };