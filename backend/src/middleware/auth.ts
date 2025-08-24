import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../utils/database';

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
  current_tenant_id?: number; // For tenant switching by super admins
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

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { 
      userId: number; 
      currentTenantId?: number; 
    };
    
    // Get user with tenant and roles
    const user = await db('users')
      .select('users.*', 'tenants.name as tenant_name', 'tenants.slug as tenant_slug', 'tenants.is_active as tenant_active')
      .join('tenants', 'users.tenant_id', 'tenants.id')
      .where({ 'users.id': decoded.userId, 'users.is_active': true })
      .first();
    
    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Get user roles
    const roles = await db('user_roles')
      .where({ user_id: user.id, is_active: true });

    // Determine current tenant context
    let currentTenantId = decoded.currentTenantId || user.tenant_id;
    
    // Super admins can switch tenants, others are locked to their tenant
    const isSuperAdmin = roles.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) {
      currentTenantId = user.tenant_id;
    }

    // Get current tenant info
    const currentTenant = await db('tenants')
      .where({ id: currentTenantId, is_active: true })
      .first();

    if (!currentTenant) {
      return res.status(401).json({ error: 'Tenant not found or inactive' });
    }

    // Verify user has access to current tenant
    const hasAccessToTenant = isSuperAdmin || 
      roles.some(r => r.tenant_id === currentTenantId && r.is_active);

    if (!hasAccessToTenant) {
      return res.status(403).json({ error: 'No access to current tenant' });
    }

    // Build user object with tenant context
    const userWithTenant: UserWithTenant = {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      tenant_id: user.tenant_id,
      is_active: user.is_active,
      tenant: {
        id: user.tenant_id,
        name: user.tenant_name,
        slug: user.tenant_slug,
        is_active: user.tenant_active
      },
      roles,
      current_tenant_id: currentTenantId
    };

    req.user = userWithTenant;
    req.tenant = currentTenant;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Helper function to check if user has role in current tenant
export const hasRole = (user: UserWithTenant, role: string): boolean => {
  return user.roles.some(r => 
    r.role === role && 
    (r.tenant_id === user.current_tenant_id || r.role === 'super_admin') &&
    r.is_active
  );
};

// Helper function to check if user is admin (tenant_admin or super_admin)
export const isAdmin = (user: UserWithTenant): boolean => {
  return hasRole(user, 'tenant_admin') || hasRole(user, 'super_admin');
};

// Legacy compatibility - maps to isAdmin for backward compatibility
export const hasAdminRole = (user: UserWithTenant): boolean => {
  return isAdmin(user);
};

// Role-based middleware
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !hasRole(req.user, 'super_admin')) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

export const requireTenantAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || (!hasRole(req.user, 'tenant_admin') && !hasRole(req.user, 'super_admin'))) {
    return res.status(403).json({ error: 'Tenant admin access required' });
  }
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  return requireTenantAdmin(req, res, next);
};

// Middleware to ensure data isolation - automatically filters by tenant
export const enforceTenantIsolation = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.tenant) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Super admins can access any tenant data based on their current tenant context
  // Other users are automatically filtered to their home tenant
  req.tenantId = req.user.current_tenant_id || req.user.tenant_id;
  next();
};