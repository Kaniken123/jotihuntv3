import { api, setToken, removeToken, getToken } from './api';
import { User, Team, Tenant } from '../types';

export interface LoginResponse {
  user: User;
  team?: Team;
  token: string;
  requires_tenant_selection?: boolean;
  tenant_options?: Array<{ id: number; name: string; slug: string; user_id: number }>;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  tenant_slug?: string;
}

export const authService = {
  async login(
    username: string,
    password: string,
    selected_tenant_id?: number
  ): Promise<LoginResponse> {
    const response = await api.post('/auth/login', {
      username,
      password,
      selected_tenant_id,
    });
    
    if (response.data.token) {
      await setToken(response.data.token);
    }
    
    return response.data;
  },

  async register(userData: RegisterData): Promise<{ user: User }> {
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
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors
    } finally {
      await removeToken();
    }
  },

  async switchTenant(tenantId: number): Promise<{ tenant: Tenant; token: string }> {
    const response = await api.post('/auth/switch-tenant', { tenant_id: tenantId });
    if (response.data.token) {
      await setToken(response.data.token);
    }
    return response.data;
  },

  async getTenants(): Promise<Tenant[]> {
    const response = await api.get('/auth/tenants');
    return response.data;
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await getToken();
    return !!token;
  },
};

export default authService;
