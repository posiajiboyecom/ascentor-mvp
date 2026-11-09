import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ascentor.app',
  appName: 'Ascentor',
  webDir: 'out',
  server: {
    // During development, point to your local Next.js server
    // Comment this out for production builds
    url: 'http://YOUR_LOCAL_IP:3000',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      // Keep native splash brief — our JS splash (AscentorSplash) plays immediately
      // after WebView is ready and covers the full 3-second animation.
      launchShowDuration: 500,
      launchAutoHide: true,
      backgroundColor: '#FAFAF8',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0C0B08',
    },
  },
};

export default config;