// lib/cookies.ts
// Lightweight client-side cookie helpers for UX state.
// All cookies are non-sensitive, non-httpOnly, SameSite=Lax.
// Server-side reading (from Next.js request cookies) is in lib/cookies-server.ts

export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1];
}

export function setCookie(name: string, value: string, days = 30) {
  if (typeof document === 'undefined') return;
  const exp = new Date(Date.now() + days * 86_400_000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}

export function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

// ── Named UX cookies ──────────────────────────────────────────────────────────

/** Last nav tab the user visited (home | coach | circle | learn | account) */
export const NAV_TAB_COOKIE = 'as_nav';

/** Comma-separated list of banner IDs the user has dismissed */
export const DISMISSED_BANNERS_COOKIE = 'as_dismissed';

export function getLastNavTab(): string | undefined {
  return getCookie(NAV_TAB_COOKIE) ? decodeURIComponent(getCookie(NAV_TAB_COOKIE)!) : undefined;
}

export function setLastNavTab(tab: string) {
  setCookie(NAV_TAB_COOKIE, tab, 30);
}

export function isBannerDismissed(bannerId: string): boolean {
  const raw = getCookie(DISMISSED_BANNERS_COOKIE);
  if (!raw) return false;
  return decodeURIComponent(raw).split(',').includes(bannerId);
}

export function dismissBanner(bannerId: string) {
  const existing = getCookie(DISMISSED_BANNERS_COOKIE);
  const ids = existing ? decodeURIComponent(existing).split(',') : [];
  if (!ids.includes(bannerId)) ids.push(bannerId);
  // Keep at most 20 dismissed IDs (oldest drop off)
  setCookie(DISMISSED_BANNERS_COOKIE, ids.slice(-20).join(','), 30);
}
