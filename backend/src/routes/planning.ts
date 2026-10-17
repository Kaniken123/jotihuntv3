import express from 'express';
import { db } from '../utils/database';
import { authenticateToken, requireAdmin, enforceTenantIsolation } from '../middleware/auth';
import { getSocketIO } from '../socketManager';
import { sendPushToUsers } from '../services/pushService';

const router = express.Router();

export const ACTIVITIES = ['unassigned', 'hunt', 'creatief', 'fotos', 'puzzels'] as const;

// Broadcast that the board changed so every open board stays in sync.
function broadcast(tenantId: number) {
  try {
    getSocketIO().to(`tenant-${tenantId}`).emit('planning-updated', {});
  } catch {
    /* socket not ready — the next poll/refresh will pick it up */
  }
}

// Rows joined with the owning user's name/plate, newest first per activity.
async function listEntries(tenantId: number) {
  return db('planning_entries as p')
    .leftJoin('users as u', 'p.user_id', 'u.id')
    .where('p.tenant_id', tenantId)
    .orderBy('p.id')
    .select(
      'p.id',
      'p.user_id',
      'p.display_name',
      'p.activity',
      'p.track_location',
      'p.timer_started_at',
      'p.threshold_minutes',
      'p.overrun_notified',
      'p.returned_at',
      'u.username',
      'u.first_name',
      'u.last_name',
      'u.license_plate'
    );
}

// GET the board. Every approved+active user gets a card automatically (in
// 'unassigned' the first time) so the board always shows the whole team.
router.get('/', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const users = await db('users')
      .where({ tenant_id: tenantId, is_active: true })
      .andWhere(function () {
        this.where('status', 'approved').orWhereNull('status');
      })
      .select('id');

    const existing = await db('planning_entries')
      .where({ tenant_id: tenantId })
      .whereNotNull('user_id')
      .select('user_id');
    const have = new Set(existing.map((r) => r.user_id));

    const missing = users.filter((u) => !have.has(u.id));
    if (missing.length) {
      await db('planning_entries').insert(
        missing.map((u) => ({
          tenant_id: tenantId,
          user_id: u.id,
          activity: 'unassigned',
          created_at: new Date(),
          updated_at: new Date(),
        }))
      );
    }

    res.json({ activities: ACTIVITIES, entries: await listEntries(tenantId) });
  } catch (error) {
    console.error('Get planning error:', error);
    res.status(500).json({ error: 'Failed to load planning board' });
  }
});

// Add a manual name (someone without an account).
router.post('/', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const name = String(req.body?.display_name || '').trim();
    const activity = String(req.body?.activity || 'unassigned');
    if (!name) return res.status(400).json({ error: 'display_name is required' });
    if (!ACTIVITIES.includes(activity as any)) return res.status(400).json({ error: 'Invalid activity' });

    await db('planning_entries').insert({
      tenant_id: req.tenantId!,
      user_id: null,
      display_name: name,
      activity,
      created_at: new Date(),
      updated_at: new Date(),
    });
    broadcast(req.tenantId!);
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Add planning entry error:', error);
    res.status(500).json({ error: 'Failed to add person' });
  }
});

// Shared notepad beside the board: one text per tenant, last save wins.
router.get('/notes', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const row = await db('planning_notes').where({ tenant_id: req.tenantId! }).first();
    res.json({ content: row?.content || '', updated_at: row?.updated_at || null });
  } catch (error) {
    console.error('Get planning notes error:', error);
    res.status(500).json({ error: 'Failed to load notes' });
  }
});

router.put('/notes', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const content = String(req.body?.content ?? '');
    const row = { content, updated_by: req.user!.id, updated_at: new Date() };
    const n = await db('planning_notes').where({ tenant_id: tenantId }).update(row);
    if (!n) await db('planning_notes').insert({ ...row, tenant_id: tenantId });

    try {
      getSocketIO().to(`tenant-${tenantId}`).emit('planning-notes-updated', { content, by: req.user!.id });
    } catch {
      /* socket not ready — others pick it up on their next load */
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Save planning notes error:', error);
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

// Move a card between activities (drag & drop).
router.patch('/:id', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const patch: any = { updated_at: new Date() };
    if (req.body?.activity !== undefined) {
      if (!ACTIVITIES.includes(req.body.activity)) return res.status(400).json({ error: 'Invalid activity' });
      patch.activity = req.body.activity;
    }
    if (req.body?.display_name !== undefined) patch.display_name = String(req.body.display_name).trim();
    if (req.body?.track_location !== undefined) patch.track_location = !!req.body.track_location;

    const before = await db('planning_entries')
      .where({ id: Number(req.params.id), tenant_id: req.tenantId! })
      .first();

    const n = await db('planning_entries')
      .where({ id: Number(req.params.id), tenant_id: req.tenantId! })
      .update(patch);
    if (!n) return res.status(404).json({ error: 'Entry not found' });
    broadcast(req.tenantId!);

    // Switching tracking ON nudges that phone so it starts sending again,
    // even when the app is sitting in the background.
    if (before && before.user_id && patch.track_location === true && !before.track_location) {
      void sendPushToUsers([before.user_id], {
        title: '📍 Locatie delen staat aan',
        body: 'Het clubhuis volgt je locatie zolang je onderweg bent.',
        data: { type: 'tracking-on' },
        channelId: 'default',
      }).catch((e) => console.error('tracking push error:', e));
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Update planning entry error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// Remove a card. Manual names disappear; account-linked cards come back on the
// next board load (they are the team roster), so they just reset to unassigned.
router.delete('/:id', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    await db('planning_entries').where({ id: Number(req.params.id), tenant_id: req.tenantId! }).del();
    broadcast(req.tenantId!);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete planning entry error:', error);
    res.status(500).json({ error: 'Failed to remove entry' });
  }
});

// Start the "on the road" timer (admin presses this when the hunter leaves).
router.post('/:id/leave', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const threshold = Number(req.body?.threshold_minutes) || 180;
    const n = await db('planning_entries')
      .where({ id: Number(req.params.id), tenant_id: req.tenantId! })
      .update({
        timer_started_at: new Date(),
        threshold_minutes: threshold,
        overrun_notified: false,
        returned_at: null,
        updated_at: new Date(),
      });
    if (!n) return res.status(404).json({ error: 'Entry not found' });
    broadcast(req.tenantId!);
    res.json({ ok: true });
  } catch (error) {
    console.error('Start timer error:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// Stop the timer. `returned` marks them as back; otherwise it is just cleared.
router.post('/:id/stop', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const returned = req.body?.returned !== false;
    const n = await db('planning_entries')
      .where({ id: Number(req.params.id), tenant_id: req.tenantId! })
      .update({
        timer_started_at: null,
        overrun_notified: false,
        returned_at: returned ? new Date() : null,
        updated_at: new Date(),
      });
    if (!n) return res.status(404).json({ error: 'Entry not found' });
    broadcast(req.tenantId!);
    res.json({ ok: true });
  } catch (error) {
    console.error('Stop timer error:', error);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

// Tell the hunter to come back — a loud push on the 'alerts' channel.
router.post('/:id/send-back', authenticateToken, requireAdmin, enforceTenantIsolation, async (req, res) => {
  try {
    const entry = await db('planning_entries')
      .where({ id: Number(req.params.id), tenant_id: req.tenantId! })
      .first();
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (!entry.user_id) {
      return res.status(400).json({ error: 'This person has no account, so they cannot be notified' });
    }

    await sendPushToUsers([entry.user_id], {
      title: '🔔 Kom terug naar het clubhuis',
      body: String(req.body?.message || 'Je bent al best een tijd weg. Kom svp terug naar het clubhuis'),
      data: { type: 'return-to-base' },
      sound: 'default',
      channelId: 'alerts',
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('Send-back error:', error);
    res.status(500).json({ error: 'Failed to send the notification' });
  }
});

// Background check: flag timers that passed their threshold, alert the admins
// once per timer (in-app via socket + a push to admin devices).
export function startPlanningOverrunWatcher() {
  const INTERVAL_MS = 60_000;
  setInterval(async () => {
    try {
      const rows = await db('planning_entries')
        .whereNotNull('timer_started_at')
        .whereNull('returned_at')
        .where('overrun_notified', false)
        .select('*');

      for (const e of rows) {
        const started = new Date(e.timer_started_at).getTime();
        const dueAt = started + e.threshold_minutes * 60_000;
        if (Date.now() < dueAt) continue;

        await db('planning_entries').where({ id: e.id }).update({ overrun_notified: true, updated_at: new Date() });

        let name = e.display_name;
        if (!name && e.user_id) {
          const u = await db('users').where({ id: e.user_id }).first();
          name = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username : 'Een hunter';
        }

        try {
          getSocketIO().to(`tenant-${e.tenant_id}`).emit('planning-overrun', {
            entry_id: e.id,
            name,
            threshold_minutes: e.threshold_minutes,
          });
        } catch { /* no socket yet */ }

        // Push the admins of this tenant.
        const adminIds = (
          await db('user_roles')
            .where('tenant_id', e.tenant_id)
            .where('is_active', true)
            .where('role', 'like', '%admin%')
            .distinct('user_id')
        ).map((r) => r.user_id);
        if (adminIds.length) {
          await sendPushToUsers(adminIds, {
            title: '⏰ Hunttijd verstreken',
            body: `${name} is langer dan ${e.threshold_minutes} min onderweg.`,
            data: { type: 'planning-overrun', entry_id: String(e.id) },
            channelId: 'alerts',
          });
        }
      }
    } catch (err) {
      console.error('Planning overrun watcher error:', (err as Error).message);
    }
  }, INTERVAL_MS);
}

export default router;
