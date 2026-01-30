"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceTenantIsolation = exports.requireAdmin = exports.requireTenantAdmin = exports.requireSuperAdmin = exports.hasAdminRole = exports.isAdmin = exports.hasRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../utils/database");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Get user with tenant and roles
        const user = await (0, database_1.db)('users')
            .select('users.*', 'tenants.name as tenant_name', 'tenants.slug as tenant_slug', 'tenants.is_active as tenant_active')
            .join('tenants', 'users.tenant_id', 'tenants.id')
            .where({ 'users.id': decoded.userId, 'users.is_active': true })
            .first();
        if (!user) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }
        // Get user roles
        const roles = await (0, database_1.db)('user_roles')
            .where({ user_id: user.id, is_active: true });
        // Determine current tenant context
        let currentTenantId = decoded.currentTenantId || user.tenant_id;
        // Super admins can switch tenants, others are locked to their tenant
        const isSuperAdmin = roles.some(r => r.role === 'super_admin');
        if (!isSuperAdmin) {
            currentTenantId = user.tenant_id;
        }
        // Get current tenant info
        const currentTenant = await (0, database_1.db)('tenants')
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
        const userWithTenant = {
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
    }
    catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};
exports.authenticateToken = authenticateToken;
// Helper function to check if user has role in current tenant
const hasRole = (user, role) => {
    return user.roles.some(r => r.role === role &&
        (r.tenant_id === user.current_tenant_id || r.role === 'super_admin') &&
        r.is_active);
};
exports.hasRole = hasRole;
// Helper function to check if user is admin (tenant_admin or super_admin)
const isAdmin = (user) => {
    return (0, exports.hasRole)(user, 'tenant_admin') || (0, exports.hasRole)(user, 'super_admin');
};
exports.isAdmin = isAdmin;
// Legacy compatibility - maps to isAdmin for backward compatibility
const hasAdminRole = (user) => {
    return (0, exports.isAdmin)(user);
};
exports.hasAdminRole = hasAdminRole;
// Role-based middleware
const requireSuperAdmin = (req, res, next) => {
    if (!req.user || !(0, exports.hasRole)(req.user, 'super_admin')) {
        return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
};
exports.requireSuperAdmin = requireSuperAdmin;
const requireTenantAdmin = (req, res, next) => {
    if (!req.user || (!(0, exports.hasRole)(req.user, 'tenant_admin') && !(0, exports.hasRole)(req.user, 'super_admin'))) {
        return res.status(403).json({ error: 'Tenant admin access required' });
    }
    next();
};
exports.requireTenantAdmin = requireTenantAdmin;
const requireAdmin = (req, res, next) => {
    return (0, exports.requireTenantAdmin)(req, res, next);
};
exports.requireAdmin = requireAdmin;
// Middleware to ensure data isolation - automatically filters by tenant
const enforceTenantIsolation = (req, res, next) => {
    if (!req.user || !req.tenant) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    // Super admins can access any tenant data based on their current tenant context
    // Other users are automatically filtered to their home tenant
    req.tenantId = req.user.current_tenant_id || req.user.tenant_id;
    next();
};
exports.enforceTenantIsolation = enforceTenantIsolation;
//# sourceMappingURL=auth.js.map