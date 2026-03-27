import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export async function initMobilePush() {
  // Only run on native iOS/Android — not in browser
  if (!Capacitor.isNativePlatform()) return;

  // Request permission
  const permResult = await PushNotifications.requestPermissions();
  if (permResult.receive !== 'granted') {
    console.log('Push permission denied');
    return;
  }

  // Register with APNs (iOS) or FCM (Android)
  await PushNotifications.register();

  // When registration succeeds, send the device token to your server
  PushNotifications.addListener('registration', async (token) => {
    await fetch('/api/push/subscribe-native', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token.value,
        platform: Capacitor.getPlatform(), // 'ios' or 'android'
      }),
    });
  });

  // Handle foreground notifications
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Foreground notification:', notification);
  });

  // Handle notification tap (app was in background)
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification.data?.url;
    if (url) window.location.href = url;
  });
}