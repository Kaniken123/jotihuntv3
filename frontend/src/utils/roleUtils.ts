import { User } from '../types';

/**
 * Check if user has admin privileges (tenant_admin or super_admin)
 */
export const isAdmin = (user: User | null): boolean => {
  if (!user) return false;
  
  // Check new multi-tenancy roles
  if (user.roles && user.roles.length > 0) {
    return user.roles.some(role => 
      role.is_active && (role.role === 'tenant_admin' || role.role === 'super_admin')
    );
  }
  
  // Fallback for legacy role system
  if (user.role === 'admin') {
    return true;
  }
  
  // Check if user is marked as super admin directly
  if (user.is_super_admin) {
    return true;
  }
  
  return false;
};

/**
 * Check if user is a super admin
 */
export const isSuperAdmin = (user: User | null): boolean => {
  if (!user) return false;
  
  // Check new multi-tenancy roles
  if (user.roles && user.roles.length > 0) {
    return user.roles.some(role => 
      role.is_active && role.role === 'super_admin'
    );
  }
  
  // Check if user is marked as super admin directly
  if (user.is_super_admin) {
    return true;
  }
  
  return false;
};

/**
 * Check if user has a specific role
 */
export const hasRole = (user: User | null, roleName: string): boolean => {
  if (!user || !user.roles) return false;
  
  return user.roles.some(role => 
    role.is_active && role.role === roleName
  );
};

/**
 * Get user's active roles
 */
export const getUserRoles = (user: User | null): string[] => {
  if (!user || !user.roles) return [];
  
  return user.roles
    .filter(role => role.is_active)
    .map(role => role.role);
};