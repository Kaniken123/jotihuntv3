import express from 'express';
import { db } from '../utils/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Register (or re-register) this device's push token for the current user.
// A token is globally unique; re-registering moves it to the current user and
// refreshes updated_at (handles a shared device / token rotation).
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { token, platform } = req.body as { token?: string; platform?: string };
    if (!token) return res.status(400).json({ error: 'token is required' });

    const existing = await db('push_tokens').where({ token }).first();
    if (existing) {
      await db('push_tokens')
        .where({ token })
        .update({ user_id: req.user!.id, platform: platform || existing.platform, updated_at: new Date() });
    } else {
      await db('push_tokens').insert({
        user_id: req.user!.id,
        token,
        platform: platform || 'android',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Push register error:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

// Unregister a device token (on logout).
router.post('/unregister', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token) return res.status(400).json({ error: 'token is required' });
    await db('push_tokens').where({ token, user_id: req.user!.id }).del();
    res.json({ ok: true });
  } catch (error) {
    console.error('Push unregister error:', error);
    res.status(500).json({ error: 'Failed to unregister push token' });
  }
});

export default router;
