import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../utils/database';
import { authenticateToken, requireAdmin, isAdmin, enforceTenantIsolation } from '../middleware/auth';

const router = express.Router();

router.get('/users', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const currentTenantId = req.tenantId!;
    
    // Get users with their roles for current tenant
    const users = await db('users')
      .select('users.id', 'users.username', 'users.email', 'users.first_name', 'users.last_name', 'users.is_active', 'users.created_at')
      .where('users.tenant_id', currentTenantId)
      .orderBy('users.username');

    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        // Get user roles for current tenant
        const roles = await db('user_roles')
          .select('role', 'is_active')
          .where({ user_id: user.id, tenant_id: currentTenantId });

        // Get team membership in current tenant
        const teamMembership = await db('team_members')
          .join('teams', 'team_members.team_id', 'teams.id')
          .select('teams.name', 'teams.area', 'team_members.role')
          .where('team_members.user_id', user.id)
          .where('teams.tenant_id', currentTenantId)
          .first();

        const primaryRole = roles.find(r => r.is_active)?.role || 'user';

        return {
          ...user,
          role: primaryRole,
          roles: roles,
          team: teamMembership
        };
      })
    );

    res.json(usersWithDetails);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/users/:id', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const { id } = req.params;
    const currentTenantId = req.tenantId!;

    if (req.user!.id !== parseInt(id) && !isAdmin(req.user!)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await db('users')
      .select('id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'created_at')
      .where({ id, tenant_id: currentTenantId })
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user roles for current tenant
    const roles = await db('user_roles')
      .select('role', 'is_active')
      .where({ user_id: user.id, tenant_id: currentTenantId });

    const teamMembership = await db('team_members')
      .join('teams', 'team_members.team_id', 'teams.id')
      .select('teams.*', 'team_members.role as member_role')
      .where('team_members.user_id', id)
      .where('teams.tenant_id', currentTenantId)
      .first();

    const primaryRole = roles.find(r => r.is_active)?.role || 'user';

    res.json({ 
      ...user, 
      role: primaryRole,
      roles: roles,
      team: teamMembership 
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.post('/users', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, role, team_id } = req.body;
    const currentTenantId = req.tenantId!;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password required' });
    }

    // Check if user exists in current tenant
    const existingUser = await db('users')
      .where({ tenant_id: currentTenantId })
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
      tenant_id: currentTenantId,
      is_active: true
    });
    
    // For SQLite, the insert result is the last inserted ID
    const userId = insertResult[0];

    // Create user role for current tenant
    await db('user_roles').insert({
      user_id: userId,
      tenant_id: currentTenantId,
      role: role || 'user',
      is_active: true
    });

    // Get the newly created user
    const user = await db('users')
      .select('id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'created_at')
      .where({ id: userId, tenant_id: currentTenantId })
      .first();

    if (!user) {
      throw new Error('Failed to create user');
    }

    if (team_id) {
      // Ensure team belongs to current tenant
      const team = await db('teams')
        .where({ id: team_id, tenant_id: currentTenantId })
        .first();
      
      if (team) {
        await db('team_members').insert({
          user_id: user.id,
          team_id,
          role: 'member'
        });
      }
    }

    res.status(201).json({
      ...user,
      role: role || 'user'
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id', authenticateToken, enforceTenantIsolation, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, first_name, last_name, role, team_id, is_active } = req.body;
    const currentTenantId = req.tenantId!;

    if (req.user!.id !== parseInt(id) && !isAdmin(req.user!)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify user exists in current tenant
    const existingUser = await db('users')
      .where({ id, tenant_id: currentTenantId })
      .first();
    
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData: any = { updated_at: new Date() };
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (first_name) updateData.first_name = first_name;
    if (last_name) updateData.last_name = last_name;
    if (typeof is_active === 'boolean' && isAdmin(req.user!)) updateData.is_active = is_active;

    await db('users').where({ id, tenant_id: currentTenantId }).update(updateData);

    // Update role if admin and role is provided
    if (role && isAdmin(req.user!)) {
      await db('user_roles')
        .where({ user_id: id, tenant_id: currentTenantId })
        .update({ role, updated_at: new Date() });
    }

    // Handle team assignment if admin is making the request
    if (isAdmin(req.user!) && team_id !== undefined) {
      // Remove existing team membership
      await db('team_members').where('user_id', id).del();
      
      // Add new team membership if team_id is provided
      if (team_id) {
        await db('team_members').insert({
          user_id: parseInt(id),
          team_id: parseInt(team_id),
          role: 'member'
        });
      }
    }

    const user = await db('users')
      .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at')
      .where('id', id)
      .first();

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Safety check: Only allow deletion of inactive users
    const user = await db('users').where('id', id).first();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.is_active) {
      return res.status(400).json({ 
        error: 'Cannot delete active user. Please deactivate the user first.' 
      });
    }

    // Prevent deletion of admin users for safety
    if (user.role === 'admin') {
      return res.status(400).json({ 
        error: 'Cannot delete admin users for security reasons.' 
      });
    }

    // Delete user and related data in transaction
    await db.transaction(async (trx) => {
      // Remove team memberships
      await trx('team_members').where('user_id', id).del();
      
      // Remove auth tokens
      await trx('auth_tokens').where('user_id', id).del();
      
      // Remove location data
      await trx('user_locations').where('user_id', id).del();
      
      // Remove location settings
      await trx('location_settings').where('user_id', id).del();
      
      // Remove article reads
      await trx('user_article_reads').where('user_id', id).del();
      
      // Remove assignment completions
      await trx('user_assignment_completions').where('user_id', id).del();
      
      // Finally delete the user
      await trx('users').where('id', id).del();
    });

    res.json({ message: 'User permanently deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.post('/users/:id/change-password', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { current_password, new_password } = req.body;

    if (req.user!.id !== parseInt(id) && !isAdmin(req.user!)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!new_password) {
      return res.status(400).json({ error: 'New password required' });
    }

    const user = await db('users').where('id', id).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!isAdmin(req.user!) && !await bcrypt.compare(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await db('users').where('id', id).update({ password_hash, updated_at: new Date() });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Assign user to team
router.post('/users/:user_id/assign-team', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { team_id } = req.body;
    const currentTenantId = req.tenantId!;

    if (!team_id) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Verify user exists and belongs to current tenant
    const user = await db('users')
      .where('id', user_id)
      .where('tenant_id', currentTenantId)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify team exists and belongs to current tenant
    const team = await db('teams')
      .where('id', team_id)
      .where('tenant_id', currentTenantId)
      .first();

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Remove user from any existing team in this tenant
    // First get the team ids for this tenant
    const teamIds = await db('teams')
      .select('id')
      .where('tenant_id', currentTenantId)
      .pluck('id');
    
    await db('team_members')
      .where('user_id', user_id)
      .whereIn('team_id', teamIds)
      .del();

    // Add user to new team
    await db('team_members').insert({
      user_id: parseInt(user_id),
      team_id: parseInt(team_id),
      role: 'member',
      joined_at: new Date()
    });

    // Get updated user with team info
    const updatedUser = await db('users')
      .select(
        'users.*',
        'teams.id as team_id',
        'teams.name as team_name', 
        'teams.area as team_area',
        'team_members.role as team_role'
      )
      .leftJoin('team_members', 'users.id', 'team_members.user_id')
      .leftJoin('teams', 'team_members.team_id', 'teams.id')
      .where('users.id', user_id)
      .where('users.tenant_id', currentTenantId)
      .first();

    res.json({
      message: 'User assigned to team successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Assign user to team error:', error);
    res.status(500).json({ error: 'Failed to assign user to team' });
  }
});

// Remove user from team
router.delete('/users/:user_id/remove-team', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const { user_id } = req.params;
    const currentTenantId = req.tenantId!;

    // Verify user exists and belongs to current tenant
    const user = await db('users')
      .where('id', user_id)
      .where('tenant_id', currentTenantId)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove user from all teams in this tenant
    const teamIds = await db('teams')
      .select('id')
      .where('tenant_id', currentTenantId)
      .pluck('id');
    
    await db('team_members')
      .where('user_id', user_id)
      .whereIn('team_id', teamIds)
      .del();

    res.json({
      message: 'User removed from team successfully'
    });
  } catch (error) {
    console.error('Remove user from team error:', error);
    res.status(500).json({ error: 'Failed to remove user from team' });
  }
});

// Get available teams for assignment
router.get('/teams/available', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const currentTenantId = req.tenantId!;
    
    const teams = await db('teams')
      .select('id', 'name', 'area', 'description')
      .where('tenant_id', currentTenantId)
      .where('is_active', true)
      .orderBy('area')
      .orderBy('name');

    res.json(teams);
  } catch (error) {
    console.error('Get available teams error:', error);
    res.status(500).json({ error: 'Failed to get available teams' });
  }
});

export default router;