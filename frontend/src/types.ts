export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'user';
  team_id?: number;
  team?: Team;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: number;
  name: string;
  area?: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface Hunt {
  id: number;
  user_id: number;
  team_id: number;
  fox_area: string;
  photo_url: string;
  coordinates_lat: number;
  coordinates_lng: number;
  points_awarded?: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: number;
  user?: User;
  team?: Team;
}

export interface ChatMessage {
  id: number;
  team_id: number;
  user_id: number;
  message: string;
  created_at: string;
  user?: User;
}

export interface Hint {
  id: number;
  title: string;
  description: string;
  area?: string;
  is_assignment: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationSettings {
  id?: number;
  user_id: number;
  tracking_interval: number;
  offline_threshold: number;
  location_sharing_enabled: boolean;
  privacy_mode: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationData {
  id: string;
  type: 'message' | 'hunt' | 'assignment' | 'location' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any;
}

export interface Location {
  id: number;
  user_id: number;
  team_id: number;
  lat: number;
  lng: number;
  accuracy?: number;
  recorded_at: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  team: Team | null;
  token: string | null;
}