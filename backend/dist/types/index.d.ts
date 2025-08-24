export interface User {
    id: number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    role: 'admin' | 'user';
    is_active: boolean;
    created_at: string;
    updated_at: string;
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
    updated_at: string;
}
export interface TeamMember {
    id: number;
    user_id: number;
    team_id: number;
    role: 'leader' | 'member';
    joined_at: string;
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
}
export interface Article {
    id: number;
    title: string;
    content: string;
    type: 'hint' | 'assignment' | 'news';
    area?: string;
    published_at: string;
    is_active: boolean;
}
export interface UserLocation {
    id: number;
    user_id: number;
    lat: number;
    lng: number;
    accuracy?: number;
    recorded_at: string;
    source: string;
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
    user?: Partial<User>;
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
}
export interface LocationSettings {
    id: number;
    user_id: number;
    tracking_interval: number;
    offline_threshold: number;
    location_sharing_enabled: boolean;
    privacy_mode: boolean;
}
//# sourceMappingURL=index.d.ts.map