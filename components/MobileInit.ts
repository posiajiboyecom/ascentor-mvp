'use client';
// Runs once per page load. Does nothing in a browser; inside the iOS / Android app it hands over from the
// native launch screen and sets up the status bar and (once enabled) push.
import { useEffect } from 'react';
import { isNativeApp, nativePlatform } from '@/lib/native';

export function MobileInit() {
  useEffect(() => {
    if (!isNativeApp()) return;

    // Lets CSS and other components adapt to the app (e.g. hide "install the app" prompts).
    document.documentElement.dataset.native = nativePlatform() ?? 'app';

    // The page is on screen: take the native launch screen away. (It also hides itself after a few
    // seconds, so a failure here can never leave the app stuck on it.)
    import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide())
      .catch(() => {});

    // The app is light-only: dark status bar icons on the light page background.
    import('@capacitor/status-bar')
      .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: Style.Light }))
      .catch(() => {});

    import('@/lib/mobile-push').then((m) => m.initMobilePush()).catch(() => {});
  }, []);
  return null;
}
