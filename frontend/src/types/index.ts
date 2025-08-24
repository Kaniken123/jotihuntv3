export interface UserRole {
  role: 'super_admin' | 'tenant_admin' | 'user';
  tenant_id: number | null;
  is_active: boolean;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  tenant: Tenant;
  current_tenant?: Tenant;
  roles: UserRole[];
  is_super_admin: boolean;
  available_tenants?: Tenant[];
  team?: {
    name: string;
    area?: string;
    role?: string;
  };
}

export interface Team {
  id: number;
  name: string;
  description?: string;
  area?: 'Alpha' | 'Bravo' | 'Charlie' | 'Delta' | 'Echo' | 'Foxtrot' | 'Golf' | 'Hotel';
  base_lat?: number;
  base_lng?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  member_role?: 'leader' | 'member';
}

export interface Area {
  id: number;
  name: string;
  fox_team_name?: string;
  status: 'active' | 'inactive' | 'hunted';
  lat?: number;
  lng?: number;
  points: number;
  last_seen?: string;
  locations?: AreaLocation[];
}

export interface AreaLocation {
  id: number;
  area_id: number;
  lat: number;
  lng: number;
  recorded_at: string;
  source: string;
}

export interface Article {
  id: number;
  title: string;
  content: string;
  type: 'hint' | 'assignment' | 'news';
  area?: string;
  published_at: string;
  is_active: boolean;
  is_read?: boolean;
  read_at?: string;
  is_completed?: boolean;
  completed_at?: string;
  completion_notes?: string;
}

export interface UserLocation {
  id: number;
  user_id: number;
  lat: number;
  lng: number;
  accuracy?: number;
  recorded_at: string;
  source: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role?: 'admin' | 'user';
  team_name?: string;
  team_area?: string;
  team_role?: 'leader' | 'member';
  session_status?: 'active' | 'inactive';
  minutes_since_last_activity?: number;
}

export interface TeamMessage {
  id: number;
  team_id: number;
  user_id: number;
  message: string;
  attachment_url?: string;
  attachment_type?: string;
  is_edited: boolean;
  edited_at?: string;
  created_at: string;
  user?: {
    username: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface Hunt {
  id: number;
  hunter_team_id: number;
  hunter_user_id: number;
  fox_area: string;
  hunt_lat: number;
  hunt_lng: number;
  photo_url: string;
  points_awarded: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  hunt_time: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  team_name?: string;
}

export interface LocationSettings {
  id: number;
  user_id: number;
  tracking_interval: number;
  offline_threshold: number;
  location_sharing_enabled: boolean;
  privacy_mode: boolean;
}

export interface GameFilter {
  areas: string[];
  messageTypes: string[];
  showTeamLocations: boolean;
  showFoxLocations: boolean;
  showUserLocations: boolean;
}

export interface NotificationData {
  id: string;
  type: 'assignment' | 'hunt' | 'message' | 'location' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any;
}

export interface FoxRoutePoint {
  id: number;
  area_id: number;
  lat: number;
  lng: number;
  recorded_at: string;
  source: string;
}

export interface FoxRoute {
  area: {
    id: number;
    name: string;
    fox_team_name?: string;
  };
  route: FoxRoutePoint[];
  route_stats: {
    total_points: number;
    time_span_hours: number;
    first_point: string | null;
    last_point: string | null;
  };
}

export interface Subscription {
  id: number;
  team_name: string;
  external_id?: number;
  is_participating: boolean;
  area?: string;
  lat?: number;
  lng?: number;
  fox_team_name?: string;
  visited_by_foxes?: string[]; // Array van fox team names die deze groep al bezocht hebben
  locations?: SubscriptionLocation[];
  created_at: string;
  updated_at?: string;
}

export interface SubscriptionLocation {
  id: number;
  subscription_id: number;
  lat: number;
  lng: number;
  recorded_at: string;
}