import axios from 'axios';
import { User, Team } from '../types';

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
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async login(username: string, password: string): Promise<{ user: User; team?: Team; token: string }> {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  async register(userData: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }): Promise<{ user: User }> {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  async getCurrentUser(): Promise<{ user: User; team?: Team }> {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};

export { api };