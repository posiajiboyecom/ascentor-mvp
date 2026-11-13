// lib/splash.ts
// Single source of truth for when the Ascentor splash plays.
//
// Rules (never on the public website — only on app paths):
//   1. Installed PWA (display-mode: standalone) or the iOS / Android app — every time the app is opened
//      from its icon, and when it comes back to the foreground after 5+ minutes away.
//   2. Any browser (incl. desktop) — once, right after sign-up or sign-in.
//      The server marks this with a short-lived cookie (markSplashPending) on the
//      redirect that ends every sign-in; the splash clears it when it plays.
//
// The first-frame decision is made by the inline pre-paint script in the root
// layout (splashPrePaintScript), so the app never flashes behind the splash.
// SplashGate handles everything after hydration.

import type { NextResponse } from 'next/server';
import { isNativeApp } from '@/lib/native';

export const SPLASH_COVER_ID = 'ascentor-splash-cover';
export const SPLASH_PENDING_COOKIE = 'as_splash_pending';
/** localStorage key: when the installed app last went to the background. */
export const SPLASH_AWAY_KEY = 'as_splash_hidden_at';
/** How long the installed app must be away before the splash replays on return. */
export const SPLASH_RETURN_MS = 5 * 60 * 1000;
/** Hard cap: the cover is always removed after this, even if the splash never loads. */
export const SPLASH_COVER_MAX_MS = 8000;

/** First path segments that belong to the app (everything else is the public website). */
export const SPLASH_APP_SEGMENTS = [
  'dashboard', 'coach', 'circle', 'sessions', 'learn', 'account', 'announcements',
  'community', 'experts', 'growth', 'help', 'messages', 'notifications', 'profile',
  'referral', 'sage', 'search', 'settings', 'store', 'admin', 'onboarding',
];

export function isAppPath(pathname: string): boolean {
  return SPLASH_APP_SEGMENTS.includes(pathname.split('/')[1] || '');
}

/** True for the installed PWA and for the iOS / Android app: both open from an icon, so both get the splash. */
export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
      || isNativeApp();
  } catch {
    return false;
  }
}

export function hasPendingSplash(): boolean {
  return document.cookie.split('; ').includes(`${SPLASH_PENDING_COOKIE}=1`);
}

export function clearPendingSplash(): void {
  document.cookie = `${SPLASH_PENDING_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
}

/** Server: call on the redirect that completes a sign-in or sign-up. */
export function markSplashPending(res: NextResponse): NextResponse {
  res.cookies.set(SPLASH_PENDING_COOKIE, '1', {
    path: '/',
    maxAge: 30 * 60, // covers a detour through checkout before the first app page
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false, // read by the pre-paint script
  });
  return res;
}

/**
 * Inline script that runs before first paint. Sets window.__asSplash to
 * 'signin' | 'appopen' | '' and hides the cover unless the splash will play.
 *
 * Deliberately contains no regex and no backslashes: it is embedded as a string,
 * and an escaped slash here is what blanked the whole site on 9 Nov 2026.
 */
export function splashPrePaintScript(): string {
  return `(function(){var play='';try{
var seg=location.pathname.split('/')[1]||'';
if(${JSON.stringify(SPLASH_APP_SEGMENTS)}.indexOf(seg)>-1){
  if(document.cookie.split('; ').indexOf('${SPLASH_PENDING_COOKIE}=1')>-1){play='signin';}
  else{
    var sa=false;try{sa=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true||!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());}catch(e){}
    if(sa){
      var nav=performance.getEntriesByType?performance.getEntriesByType('navigation')[0]:null;
      var type=nav&&nav.type?nav.type:'navigate';
      var internal=(document.referrer||'').indexOf(location.origin+'/')===0;
      var away=0;try{away=Number(localStorage.getItem('${SPLASH_AWAY_KEY}'))||0;}catch(e){}
      if(type==='navigate'&&!internal){play='appopen';}
      else if(away&&Date.now()-away>=${SPLASH_RETURN_MS}){play='appopen';}
    }
  }
}
}catch(e){}
window.__asSplash=play;
var el=document.getElementById('${SPLASH_COVER_ID}');
if(el){if(!play){el.style.display='none';}else{setTimeout(function(){el.style.display='none';},${SPLASH_COVER_MAX_MS});}}
})();`;
}
