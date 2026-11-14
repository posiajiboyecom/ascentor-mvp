// lib/theme.ts
// Light / dark theme for the member app. Light is the default; dark is a per-device choice
// made in Settings and kept in localStorage. Dark only ever applies on member app pages:
// the public website, admin, sign-in and the call screen stay light.
//
// The choice is applied as data-app-theme="dark" on <html>. The inline script from
// themePrePaintScript() sets it before first paint (no light flash); ThemeSync keeps it
// right across in-app navigation. All dark styling lives in styles/dark.css.

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'as_theme';
export const THEME_EVENT = 'as-theme-change';
export const THEME_COLOR = { light: '#FAFAF8', dark: '#0A0A0A' } as const;

/** First path segments where the dark theme applies (the member app, minus admin and calls). */
export const THEME_SEGMENTS = [
  'dashboard', 'coach', 'circle', 'sessions', 'learn', 'account', 'announcements',
  'community', 'experts', 'growth', 'help', 'messages', 'notifications', 'profile',
  'referral', 'sage', 'search', 'settings', 'store', 'onboarding', 'offline',
];

export function themeApplies(pathname: string): boolean {
  return THEME_SEGMENTS.includes(pathname.split('/')[1] || '');
}

export function getStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Puts the stored choice on <html> for this path, and keeps the browser's toolbar colour in step. */
export function applyTheme(pathname: string): Theme {
  const theme: Theme = themeApplies(pathname) ? getStoredTheme() : 'light';
  const root = document.documentElement;
  if (root.getAttribute('data-app-theme') !== theme) root.setAttribute('data-app-theme', theme);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLOR[theme]));
  return theme;
}

export function setStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  applyTheme(window.location.pathname);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Inline, runs before first paint. Keep it tiny and dependency-free. */
export function themePrePaintScript(): string {
  return `(function(){try{var s=location.pathname.split('/')[1]||'';if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==='dark'&&${JSON.stringify(THEME_SEGMENTS)}.indexOf(s)>-1){document.documentElement.setAttribute('data-app-theme','dark');}}catch(e){}})();`;
}
