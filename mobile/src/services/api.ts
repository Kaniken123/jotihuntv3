import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../utils/config';

const TOKEN_KEY = 'auth_token';

// In-memory fallback for when storage fails
let memoryToken: string | null = null;

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: config.API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management functions with fallback chain:
// 1. Try SecureStore (most secure)
// 2. Fall back to AsyncStorage (works reliably)
// 3. Fall back to memory (last resort)

export const getToken = async (): Promise<string | null> => {
  try {
    // Try SecureStore first
    const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (secureToken) {
      console.log('[Auth] Token retrieved from SecureStore');
      return secureToken;
    }
  } catch (error) {
    console.warn('[Auth] SecureStore get failed:', error);
  }

  try {
    // Fall back to AsyncStorage
    const asyncToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (asyncToken) {
      console.log('[Auth] Token retrieved from AsyncStorage');
      return asyncToken;
    }
  } catch (error) {
    console.warn('[Auth] AsyncStorage get failed:', error);
  }

  // Last resort: memory
  if (memoryToken) {
    console.log('[Auth] Token retrieved from memory');
  }
  return memoryToken;
};

export const setToken = async (token: string): Promise<void> => {
  // Always store in memory as backup
  memoryToken = token;
  console.log('[Auth] Token stored in memory');

  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    console.log('[Auth] Token stored in SecureStore');
  } catch (error) {
    console.warn('[Auth] SecureStore set failed:', error);
  }

  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    console.log('[Auth] Token stored in AsyncStorage');
  } catch (error) {
    console.warn('[Auth] AsyncStorage set failed:', error);
  }
};

export const removeToken = async (): Promise<void> => {
  memoryToken = null;

  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.warn('[Auth] SecureStore delete failed:', error);
  }

  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.warn('[Auth] AsyncStorage delete failed:', error);
  }
};

// Request interceptor to add auth token
api.interceptors.request.use(
  async (requestConfig) => {
    const token = await getToken();
    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    return requestConfig;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - remove it
      await removeToken();
    }
    return Promise.reject(error);
  }
);

export { api };
