import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../utils/database';
import { authenticateToken, requireSuperAdmin, hasRole } from '../middleware/auth';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

router.post('/login', async (req, res) => {
  try {
    const { username, password, selected_tenant_id } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find all users with this username across all tenants
    const usersWithTenants = await db('users')
      .select('users.*', 'tenants.id as tenant_id', 'tenants.name as tenant_name', 'tenants.slug as tenant_slug', 'tenants.is_active as tenant_active')
      .join('tenants', 'users.tenant_id', 'tenants.id')
      .where({ 
        'users.username': username,
        'users.is_active': true, 
        'tenants.is_active': true 
      });

    if (usersWithTenants.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password against first user (same password should work for all instances)
    const passwordValid = await bcrypt.compare(password, usersWithTenants[0].password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Determine which tenant to use
    let selectedUser;
    if (selected_tenant_id) {
      // User has selected a specific tenant
      selectedUser = usersWithTenants.find(u => u.tenant_id === parseInt(selected_tenant_id));
      if (!selectedUser) {
        return res.status(401).json({ error: 'Invalid tenant selection' });
      }
    } else {
      // Use first tenant by default
      selectedUser = usersWithTenants[0];
    }

    const user = selectedUser;

    // Get user roles
    const roles = await db('user_roles')
      .where({ user_id: user.id, is_active: true });

    // Get available tenants for super admins
    let availableTenants: Array<{id: number, name: string, slug: string}> = [];
    const isSuperAdmin = roles.some(r => r.role === 'super_admin');
    
    if (isSuperAdmin) {
      availableTenants = await db('tenants')
        .select('id', 'name', 'slug')
        .where({ is_active: true })
        .orderBy('name');
    }

    const token = jwt.sign({ 
      userId: user.id,
      currentTenantId: user.tenant_id 
    }, JWT_SECRET, { expiresIn: '7d' });

    await db('auth_tokens').insert({
      user_id: user.id,
      tenant_id: user.tenant_id,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const { password_hash, ...userWithoutPassword } = user;

    // Prepare tenant information for multi-tenant users
    const userTenants = usersWithTenants.map(u => ({
      id: u.tenant_id,
      name: u.tenant_name,
      slug: u.tenant_slug,
      user_id: u.id // Include user ID for this tenant
    }));

    // Check if user has multiple tenant options
    const hasMultipleTenants = usersWithTenants.length > 1;
    
    res.json({ 
      user: {
        ...userWithoutPassword,
        tenant: {
          id: user.tenant_id,
          name: user.tenant_name,
          slug: user.tenant_slug
        },
        roles,
        is_super_admin: isSuperAdmin,
        available_tenants: availableTenants,
        user_tenants: userTenants,
        has_multiple_tenants: hasMultipleTenants
      }, 
      token,
      // Return tenant selection info if user has multiple tenants
      requires_tenant_selection: hasMultipleTenants && !selected_tenant_id,
      tenant_options: hasMultipleTenants ? userTenants : undefined
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, tenant_slug } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Get the tenant (default to first active tenant if not specified)
    let tenant;
    if (tenant_slug) {
      tenant = await db('tenants')
        .select('id', 'name', 'slug', 'is_active')
        .where({ slug: tenant_slug, is_active: true })
        .first();
    } else {
      tenant = await db('tenants')
        .select('id', 'name', 'slug', 'is_active')
        .where({ is_active: true })
        .orderBy('id')
        .first();
    }

    if (!tenant) {
      return res.status(400).json({ error: 'No active tenant available' });
    }

    // Check if user exists in this tenant
    const existingUser = await db('users')
      .where({ tenant_id: tenant.id })
      .where(function() {
        this.where('username', username).orWhere('email', email);
      })
      .first();

    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists in this organization' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    
    // Insert user with tenant association
    const insertResult = await db('users').insert({
      username,
      email,
      password_hash,
      first_name,
      last_name,
      tenant_id: tenant.id,
      is_active: true
    });
    
    // For SQLite, the insert result is the last inserted ID
    const userId = insertResult[0];

    // Create default user role for this tenant
    await db('user_roles').insert({
      user_id: userId,
      tenant_id: tenant.id,
      role: 'user',
      is_active: true
    });

    // Get the newly created user with tenant info
    const user = await db('users')
      .select('users.*', 'tenants.name as tenant_name', 'tenants.slug as tenant_slug')
      .join('tenants', 'users.tenant_id', 'tenants.id')
      .where('users.id', userId)
      .first();

    if (!user) {
      throw new Error('Failed to create user');
    }

    const { password_hash: _, ...userWithoutPassword } = user;

    res.status(201).json({ 
      user: {
        ...userWithoutPassword,
        tenant: {
          id: user.tenant_id,
          name: user.tenant_name,
          slug: user.tenant_slug
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user!;
    
    // Get team membership for current tenant
    const teamMembership = await db('team_members')
      .join('teams', 'team_members.team_id', 'teams.id')
      .select('teams.*', 'team_members.role as member_role')
      .where('team_members.user_id', user.id)
      .where('teams.tenant_id', user.current_tenant_id)
      .first();

    // Get available tenants for super admins
    let availableTenants: Array<{id: number, name: string, slug: string}> = [];
    const isSuperAdmin = hasRole(user, 'super_admin');
    
    if (isSuperAdmin) {
      availableTenants = await db('tenants')
        .select('id', 'name', 'slug')
        .where({ is_active: true })
        .orderBy('name');
    }

    res.json({ 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
        tenant: user.tenant,
        current_tenant: req.tenant,
        roles: user.roles,
        is_super_admin: isSuperAdmin,
        available_tenants: availableTenants
      },
      team: teamMembership 
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Tenant switching for super admins
router.post('/switch-tenant', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.body;
    const user = req.user!;

    console.log('Switch tenant request:', { tenant_id, userId: user.id, roles: user.roles });

    if (!hasRole(user, 'super_admin')) {
      return res.status(403).json({ error: 'Only super admins can switch tenants' });
    }

    console.log('User is super admin, checking tenant:', tenant_id);
    
    // Verify tenant exists and is active
    const tenantResult = await db.raw('SELECT * FROM tenants WHERE id = ? AND is_active = ? LIMIT 1', [tenant_id, 1]);
    const tenant = tenantResult[0]; // SQLite returns results as first element of array
      
    console.log('Tenant query result:', tenant);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found or inactive' });
    }

    // Generate new token with updated tenant context
    const newToken = jwt.sign({ 
      userId: user.id,
      currentTenantId: tenant_id 
    }, JWT_SECRET, { expiresIn: '7d' });

    // Store new token
    await db('auth_tokens').insert({
      user_id: user.id,
      tenant_id: tenant_id,
      token: newToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    res.json({ 
      token: newToken,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        is_active: tenant.is_active
      }
    });
  } catch (error) {
    console.error('Switch tenant error:', error);
    res.status(500).json({ error: 'Failed to switch tenant' });
  }
});

// Get available tenants for login (public endpoint)
router.get('/tenants/public', async (req, res) => {
  try {
    const tenants = await db('tenants')
      .select('id', 'name', 'slug')
      .where({ is_active: true })
      .orderBy('name');

    res.json(tenants);
  } catch (error) {
    console.error('Get public tenants error:', error);
    res.status(500).json({ error: 'Failed to get tenants' });
  }
});

// Get available tenants for super admins
router.get('/tenants', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const tenants = await db('tenants')
      .select('id', 'name', 'slug', 'description', 'is_active', 'created_at', 'updated_at')
      .where({ is_active: true })
      .orderBy('name');

    res.json(tenants);
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({ error: 'Failed to get tenants' });
  }
});

// Create new tenant
router.post('/tenants', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, slug, description } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    // Check if slug already exists
    const existingTenant = await db('tenants').where('slug', slug).first();
    if (existingTenant) {
      return res.status(409).json({ error: 'Tenant slug already exists' });
    }

    // Create tenant
    const [tenantId] = await db('tenants').insert({
      name,
      slug,
      description,
      is_active: true,
      settings: JSON.stringify({ max_teams: 10, max_users: 100, features: ['basic', 'chat', 'hunting'] })
    }).returning('id');

    const newTenant = await db('tenants').where('id', tenantId).first();
    
    res.status(201).json(newTenant);
  } catch (error) {
    console.error('Create tenant error:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// Update tenant
router.put('/tenants/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    // Check if slug already exists for different tenant
    const existingTenant = await db('tenants')
      .where('slug', slug)
      .where('id', '!=', id)
      .first();
    
    if (existingTenant) {
      return res.status(409).json({ error: 'Tenant slug already exists' });
    }

    // Update tenant
    await db('tenants')
      .where('id', id)
      .update({
        name,
        slug,
        description,
        updated_at: new Date()
      });

    const updatedTenant = await db('tenants').where('id', id).first();
    
    res.json(updatedTenant);
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      await db('auth_tokens')
        .where({ token })
        .update({ is_revoked: true });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;