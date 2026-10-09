import fs from 'fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging, MulticastMessage, SendResponse } from 'firebase-admin/messaging';
import { db } from '../utils/database';

// Remote push via Firebase Cloud Messaging (FCM). The Firebase Admin SDK is
// initialised lazily from a service-account JSON pointed to by
// FIREBASE_SERVICE_ACCOUNT_PATH (or GOOGLE_APPLICATION_CREDENTIALS). If neither
// is set / readable, push is DISABLED and every send is a silent no-op — so the
// backend runs fine in any environment that hasn't configured Firebase yet.
let initialised = false;
let enabled = false;

function ensureInit(): boolean {
  if (initialised) return enabled;
  initialised = true;
  try {
    const path =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      '';
    if (!path || !fs.existsSync(path)) {
      console.log('🔕 Push disabled (no FIREBASE_SERVICE_ACCOUNT_PATH / service account file).');
      enabled = false;
      return false;
    }
    const serviceAccount = JSON.parse(fs.readFileSync(path, 'utf8'));
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    enabled = true;
    console.log('🔔 Push enabled (Firebase Admin initialised).');
  } catch (err) {
    console.error('Push init failed — disabling push:', (err as Error).message);
    enabled = false;
  }
  return enabled;
}

export function isPushEnabled(): boolean {
  return ensureInit();
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: string; // e.g. 'default'
  channelId?: string; // Android notification channel
}

// Send a push to every active user in a tenant. Safe to call always.
export async function sendPushToTenant(tenantId: number, payload: PushPayload): Promise<void> {
  if (!ensureInit()) return;
  const users = await db('users').where({ tenant_id: tenantId, is_active: true }).select('id');
  await sendPushToUsers(users.map((u) => u.id), payload);
}

// Send a push to every registered device of the given users. Invalid/stale
// tokens are pruned. Safe to call always — no-ops when push is disabled.
export async function sendPushToUsers(userIds: number[], payload: PushPayload): Promise<void> {
  if (!ensureInit() || !userIds.length) return;

  const rows = await db('push_tokens').whereIn('user_id', userIds).select('token');
  const tokens = [...new Set(rows.map((r) => r.token).filter(Boolean))];
  if (!tokens.length) return;

  const message: MulticastMessage = {
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data || {},
    android: {
      priority: 'high',
      notification: {
        sound: payload.sound || 'default',
        channelId: payload.channelId || 'default',
      },
    },
  };

  try {
    const res = await getMessaging().sendEachForMulticast(message);
    // Prune tokens FCM reports as permanently invalid.
    const dead: string[] = [];
    res.responses.forEach((r: SendResponse, i: number) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-argument' ||
          code === 'messaging/invalid-registration-token'
        ) {
          dead.push(tokens[i]);
        }
      }
    });
    if (dead.length) {
      await db('push_tokens').whereIn('token', dead).del();
      console.log(`🔕 Pruned ${dead.length} dead push token(s).`);
    }
  } catch (err) {
    console.error('sendPushToUsers error:', (err as Error).message);
  }
}
