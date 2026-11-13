// lib/mobile-push.ts
// Push notifications inside the iOS / Android app (APNs and FCM), as opposed to web push in a browser.
//
// Nothing here runs until NEXT_PUBLIC_NATIVE_PUSH=1: registering with the push plugin before Firebase is
// configured crashes the Android app. Permission is never asked for at launch; that only happens when the
// member turns notifications on in Settings (enableMobilePush).
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { NATIVE_PUSH_ENABLED } from '@/lib/native';

let listening = false;

async function listen() {
  if (listening) return;
  listening = true;

  // When registration succeeds, save the device token against the signed-in member.
  await PushNotifications.addListener('registration', async (token) => {
    try {
      await fetch('/api/push/subscribe-native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
      });
    } catch { /* offline: the next app open registers again */ }
  });

  await PushNotifications.addListener('registrationError', (err) => {
    console.error('[push] native registration failed:', err?.error);
  });

  // Tapping a notification opens the page it points at. Only ever a path on this site.
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification.data?.url;
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) window.location.href = url;
  });
}

/** App open: if the member already allowed notifications, make sure this device is registered to them. Never prompts. */
export async function initMobilePush() {
  if (!NATIVE_PUSH_ENABLED || !Capacitor.isNativePlatform()) return;
  try {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') return;
    await listen();
    await PushNotifications.register();
  } catch (err) {
    console.error('[push] native init failed:', err);
  }
}

/** Settings toggle: ask the member, then register. Resolves true when notifications are allowed. */
export async function enableMobilePush(): Promise<boolean> {
  if (!NATIVE_PUSH_ENABLED || !Capacitor.isNativePlatform()) return false;
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return false;
    await listen();
    await PushNotifications.register();
    return true;
  } catch (err) {
    console.error('[push] native enable failed:', err);
    return false;
  }
}
