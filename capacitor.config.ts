import type { CapacitorConfig } from '@capacitor/cli';

// The iOS and Android apps are thin native shells around the live site: the WebView loads
// joinascentor.com, so every web deploy reaches the apps without a store release. Only native
// changes (this file, android/, ios/, plugins, icons) need a new build.
//
// Local testing against a dev server: CAP_SERVER_URL=http://192.168.x.x:3000 npx cap sync
// Never ship a build made that way.
const APP_URL = (process.env.CAP_SERVER_URL || 'https://joinascentor.com').replace(/\/+$/, '');
const isLocalDev = APP_URL.startsWith('http://');

const config: CapacitorConfig = {
  // Permanent once the app is in a store. Uses the domain Ascentor owns.
  appId: 'com.joinascentor.app',
  appName: 'Ascentor',
  // Holds only the "no connection" screen; the app itself comes from APP_URL.
  webDir: 'mobile-shell',
  // Shown behind the WebView while the first page loads (matches the app background, so no white flash).
  backgroundColor: '#FAFAF8',
  // Lets the server recognise requests from the native apps (lib/native.ts reads it).
  appendUserAgent: 'AscentorApp/1',
  server: {
    url: APP_URL,
    cleartext: isLocalDev,
    // Open straight into the member app; signed-out members are sent to /login by the site.
    appStartPath: '/dashboard',
    // Bundled screen shown when the site cannot be reached at all.
    errorPath: 'app-offline.html',
    // Everything else (social links, WhatsApp, external articles) opens in the phone's browser.
    allowNavigation: [
      'joinascentor.com',
      // Paystack's hosted checkout, for physical goods in the shop (card, transfer and bank redirects).
      'checkout.paystack.com',
      'standard.paystack.co',
    ],
  },
  ios: {
    // The site handles its own safe areas (viewport-fit=cover).
    contentInset: 'never',
    allowsLinkPreview: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      // The native splash covers the gap until the first page has loaded; the site hides it as soon
      // as it is ready (components/MobileInit.ts). The duration is only a safety net for a slow or
      // failed load, after which the offline screen or the page itself shows.
      launchShowDuration: 4000,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: '#FAFAF8',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

export default config;
