// lib/native-routes.ts
// Which pages belong inside the iOS / Android apps.
//
// The apps are the member app and the admin only. The public website (home, pricing, blog, the
// Summit pages, the public shop and so on) stays in the browser, where its job is to send people to
// the stores. proxy.ts uses this to turn any website page requested from inside an app back into
// the app, so a stray link can never show the marketing site in the app.
import { SPLASH_APP_SEGMENTS } from '@/lib/splash';

/** Marker the native shells add to their User-Agent (capacitor.config.ts, appendUserAgent). */
const APP_UA_MARKER = 'AscentorApp/';

/** First path segments the apps may show besides the signed-in member app and admin. */
const APP_EXTRA_SEGMENTS = [
  // Signing in and joining
  'login', 'signup', 'forgot-password', 'reset-password', 'auth', 'admin-login',
  'join', 'leader-invite', 'facilitator', 'checkout',
  // Calls take over the whole screen outside the app shell
  'call',
  // Linked from sign-up, onboarding, Settings and Help; the stores require them to be reachable in the app
  'privacy', 'terms', 'contact',
  'offline', 'api',
];

const APP_SEGMENTS = new Set<string>([...SPLASH_APP_SEGMENTS, ...APP_EXTRA_SEGMENTS]);

/** True when the request comes from the iOS or Android app. */
export function isNativeAppRequest(userAgent: string | null | undefined): boolean {
  return !!userAgent && userAgent.includes(APP_UA_MARKER);
}

/** True for pages that live inside the apps; false for the public website. */
export function isNativeAppPath(pathname: string): boolean {
  return APP_SEGMENTS.has(pathname.split('/')[1] || '');
}

/** Where the app goes instead of a website page: the member app, which sends signed-out people to /login. */
export const NATIVE_APP_HOME = '/dashboard';
