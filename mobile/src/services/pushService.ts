import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from './api';

// Remote push (FCM). Registration is best-effort and fully guarded: on a build
// without google-services.json / FCM, getDevicePushTokenAsync throws and we just
// log and move on — the app keeps working, it simply won't receive push yet.

// Foreground notifications should still surface (banner + sound).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Normal chat/deelgebied/announcement notifications.
  await Notifications.setNotificationChannelAsync('chat', {
    name: 'Chatberichten',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
  // Loud alerts (e.g. "return to base") — used by later features.
  await Notifications.setNotificationChannelAsync('alerts', {
    name: 'Belangrijke meldingen',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
  });
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Algemeen',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export async function registerForPush(): Promise<void> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      console.log('[Push] Permission not granted — skipping registration');
      return;
    }

    await ensureAndroidChannels();

    // Native device (FCM on Android / APNs on iOS) token — sent to our backend,
    // which pushes via firebase-admin. (Not an Expo token; no EAS projectId needed.)
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const token = tokenResp.data as string;
    if (!token) return;

    registeredToken = token;
    await api.post('/push/register', { token, platform: Platform.OS });
    console.log('[Push] Registered device token with backend');
  } catch (err: any) {
    // Most commonly: no FCM configured on this build. Non-fatal.
    console.log('[Push] Registration skipped:', err?.message || err);
  }
}

export async function unregisterPush(): Promise<void> {
  try {
    if (!registeredToken) return;
    await api.post('/push/unregister', { token: registeredToken });
    registeredToken = null;
  } catch (err: any) {
    console.log('[Push] Unregister failed:', err?.message || err);
  }
}
