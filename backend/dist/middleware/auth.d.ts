import { Request, Response, NextFunction } from 'express';
interface UserWithTenant {
    id: number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    tenant_id: number;
    is_active: boolean;
    tenant: {
        id: number;
        name: string;
        slug: string;
        is_active: boolean;
    };
    roles: Array<{
        role: 'super_admin' | 'tenant_admin' | 'user';
        tenant_id: number | null;
        is_active: boolean;
    }>;
    current_tenant_id?: number;
}
declare global {
    namespace Express {
        interface Request {
            user?: UserWithTenant;
            tenant?: {
                id: number;
                name: string;
                slug: string;
                is_active: boolean;
            };
            tenantId?: number;
        }
    }
}
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const hasRole: (user: UserWithTenant, role: string) => boolean;
export declare const isAdmin: (user: UserWithTenant) => boolean;
export declare const hasAdminRole: (user: UserWithTenant) => boolean;
export declare const requireSuperAdmin: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireTenantAdmin: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const enforceTenantIsolation: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export {};
//# sourceMappingURL=auth.d.ts.map