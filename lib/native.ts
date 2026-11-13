// lib/native.ts
// Is this page running inside the Ascentor iOS / Android app (the Capacitor shell), or in a browser?
//
// The native shell injects window.Capacitor before any page script runs, so these are safe to call
// from the first client render. They never import a Capacitor package, so they cost the website nothing.

type NativeBridge = { isNativePlatform?: () => boolean; getPlatform?: () => string };

function bridge(): NativeBridge | null {
  try {
    return (typeof window !== 'undefined' && (window as unknown as { Capacitor?: NativeBridge }).Capacitor) || null;
  } catch {
    return null;
  }
}

/** True inside the iOS or Android app. False in every browser and in the installed PWA. */
export function isNativeApp(): boolean {
  try {
    return bridge()?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/** 'ios' or 'android' inside the app, otherwise null. */
export function nativePlatform(): 'ios' | 'android' | null {
  if (!isNativeApp()) return null;
  const p = bridge()?.getPlatform?.();
  return p === 'ios' || p === 'android' ? p : null;
}

/**
 * Native push (APNs / FCM) is off until Firebase and the Apple push key are set up. Registering before
 * then crashes the Android app, so nothing may call the push plugin unless this is true.
 */
export const NATIVE_PUSH_ENABLED = process.env.NEXT_PUBLIC_NATIVE_PUSH === '1';
