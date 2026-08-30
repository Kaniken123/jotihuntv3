import express from 'express';
import { db, extractInsertId } from '../utils/database';
import { authenticateToken, requireAdmin, isAdmin } from '../middleware/auth';

const router = express.Router();

// List deelgebieden. Active only by default; admins can pass ?all=true to also
// see archived ones. Zero rows is a valid response.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const includeArchived = req.query.all === 'true' && isAdmin(req.user!);
    const query = db('deelgebieden').select('*').orderBy('name');
    if (!includeArchived) query.where('is_active', true);
    res.json(await query);
  } catch (error) {
    console.error('List deelgebieden error:', error);
    res.status(500).json({ error: 'Failed to list deelgebieden' });
  }
});

// The current user's active deelgebied memberships. Empty array = unassigned,
// which is a valid state and must break no screen.
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const rows = await db('user_deelgebied_memberships as m')
      .join('deelgebieden as d', 'm.deelgebied_id', 'd.id')
      .where('m.user_id', req.user!.id)
      .whereNull('m.left_at')
      .orderBy('d.name')
      .select('d.id', 'd.name', 'm.joined_at');
    res.json(rows);
  } catch (error) {
    console.error('My deelgebieden error:', error);
    res.status(500).json({ error: 'Failed to load memberships' });
  }
});

// Create a deelgebied (admin, live during the event).
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const id = extractInsertId(
      await db('deelgebieden').insert({ name, is_active: true }).returning('id')
    );
    const row = await db('deelgebieden').where({ id }).first();
    res.status(201).json(row);
  } catch (error) {
    console.error('Create deelgebied error:', error);
    res.status(500).json({ error: 'Failed to create deelgebied' });
  }
});

// Archive a deelgebied (admin) — soft. Never deletes: memberships, groups and
// messages still reference it.
router.patch('/:id/archive', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updated = await db('deelgebieden')
      .where({ id: req.params.id })
      .update({ is_active: false, archived_at: db.fn.now(), updated_at: db.fn.now() });
    if (!updated) return res.status(404).json({ error: 'Deelgebied not found' });
    res.json({ id: Number(req.params.id), is_active: false });
  } catch (error) {
    console.error('Archive deelgebied error:', error);
    res.status(500).json({ error: 'Failed to archive deelgebied' });
  }
});

// Current members of a deelgebied (admin).
router.get('/:id/members', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await db('user_deelgebied_memberships as m')
      .join('users as u', 'm.user_id', 'u.id')
      .where('m.deelgebied_id', req.params.id)
      .whereNull('m.left_at')
      .orderBy('u.username')
      .select('u.id', 'u.username', 'u.first_name', 'u.last_name', 'u.scouting_group', 'm.joined_at');
    res.json(rows);
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ error: 'Failed to list members' });
  }
});

// Assign a hunter to a deelgebied (admin only — no self-service). A hunter may
// belong to several deelgebieden at once, but not twice to the same one.
router.post('/:id/members', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deelgebiedId = Number(req.params.id);
    const userId = Number(req.body?.user_id);
    if (!userId) return res.status(400).json({ error: 'user_id is required' });

    const deelgebied = await db('deelgebieden').where({ id: deelgebiedId, is_active: true }).first();
    if (!deelgebied) return res.status(404).json({ error: 'Deelgebied not found or archived' });

    const user = await db('users').where({ id: userId }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await db('user_deelgebied_memberships')
      .where({ user_id: userId, deelgebied_id: deelgebiedId })
      .whereNull('left_at')
      .first();
    if (existing) return res.status(409).json({ error: 'User is already a member of this deelgebied' });

    await db('user_deelgebied_memberships').insert({
      user_id: userId,
      deelgebied_id: deelgebiedId,
      joined_at: db.fn.now(),
    });
    res.status(201).json({ deelgebied_id: deelgebiedId, user_id: userId });
  } catch (error) {
    console.error('Assign member error:', error);
    res.status(500).json({ error: 'Failed to assign member' });
  }
});

// End a hunter's membership (admin) — sets left_at, preserving history rather
// than deleting the row.
router.delete('/:id/members/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const ended = await db('user_deelgebied_memberships')
      .where({ deelgebied_id: Number(req.params.id), user_id: Number(req.params.userId) })
      .whereNull('left_at')
      .update({ left_at: db.fn.now(), updated_at: db.fn.now() });
    res.json({ ended });
  } catch (error) {
    console.error('End membership error:', error);
    res.status(500).json({ error: 'Failed to end membership' });
  }
});

export default router;
