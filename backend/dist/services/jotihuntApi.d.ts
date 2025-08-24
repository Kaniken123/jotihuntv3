interface JotihuntSubscription {
    id: number;
    name: string;
    accomodation?: string;
    street?: string;
    housenumber?: number;
    housenumber_addition?: string;
    postcode?: string;
    city?: string;
    lat: string;
    long: string;
    team_name?: string;
    is_participating?: boolean;
}
interface JotihuntArea {
    id: number;
    name: string;
    fox_team_name?: string;
    status: 'active' | 'inactive' | 'hunted';
    lat?: number;
    lng?: number;
    last_seen?: string;
}
interface JotihuntArticle {
    id: number;
    title: string;
    type: 'hint' | 'assignment' | 'news';
    publish_at: string;
    message: {
        content: string;
    };
    area?: string;
}
export declare class JotihuntApiService {
    private static fetchFromApi;
    static getSubscriptions(): Promise<JotihuntSubscription[]>;
    static getAreas(): Promise<JotihuntArea[]>;
    static getArticles(): Promise<JotihuntArticle[]>;
    static syncSubscriptions(): Promise<{
        synced: number;
        errors: number;
    }>;
    static syncAreas(): Promise<{
        synced: number;
        errors: number;
    }>;
    static syncArticles(): Promise<{
        synced: number;
        errors: number;
    }>;
    static syncAll(): Promise<{
        subscriptions: {
            synced: number;
            errors: number;
        };
        areas: {
            synced: number;
            errors: number;
        };
        articles: {
            synced: number;
            errors: number;
        };
    }>;
    static getSyncStatus(): Promise<{
        subscriptions: {
            last_sync: any;
            data: any;
        } | null;
        areas: {
            last_sync: any;
            data: any;
        } | null;
        articles: {
            last_sync: any;
            data: any;
        } | null;
    }>;
}
export {};
//# sourceMappingURL=jotihuntApi.d.ts.map