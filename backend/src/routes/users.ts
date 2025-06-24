import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../utils/database';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at')
      .orderBy('username');

    const usersWithTeams = await Promise.all(
      users.map(async (user) => {
        const teamMembership = await db('team_members')
          .join('teams', 'team_members.team_id', 'teams.id')
          .select('teams.name', 'teams.area', 'team_members.role')
          .where('team_members.user_id', user.id)
          .first();

        return {
          ...user,
          team: teamMembership
        };
      })
    );

    res.json(usersWithTeams);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user!.id !== parseInt(id) && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await db('users')
      .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at')
      .where('id', id)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const teamMembership = await db('team_members')
      .join('teams', 'team_members.team_id', 'teams.id')
      .select('teams.*', 'team_members.role as member_role')
      .where('team_members.user_id', id)
      .first();

    res.json({ ...user, team: teamMembership });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, role, team_id } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password required' });
    }

    const existingUser = await db('users')
      .where('username', username)
      .orWhere('email', email)
      .first();

    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    
    // Insert user
    await db('users').insert({
      username,
      email,
      password_hash,
      first_name,
      last_name,
      role: role || 'user',
      is_active: true
    });

    // Get the newly created user
    const user = await db('users')
      .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'created_at')
      .where('username', username)
      .first();

    if (!user) {
      throw new Error('Failed to create user');
    }

    if (team_id) {
      await db('team_members').insert({
        user_id: user.id,
        team_id,
        role: 'member'
      });
    }

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, first_name, last_name, role } = req.body;

    if (req.user!.id !== parseInt(id) && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData: any = { updated_at: new Date() };
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (first_name) updateData.first_name = first_name;
    if (last_name) updateData.last_name = last_name;
    if (role && req.user!.role === 'admin') updateData.role = role;

    await db('users').where('id', id).update(updateData);

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

    await db('users').where('id', id).update({ is_active: false });
    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.post('/users/:id/change-password', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { current_password, new_password } = req.body;

    if (req.user!.id !== parseInt(id) && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!new_password) {
      return res.status(400).json({ error: 'New password required' });
    }

    const user = await db('users').where('id', id).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user!.role !== 'admin' && !await bcrypt.compare(current_password, user.password_hash)) {
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

export default router;