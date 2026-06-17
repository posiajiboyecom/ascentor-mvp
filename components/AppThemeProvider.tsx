// FILE: components/AppThemeProvider.tsx
// FIX: #2 — fires 'asc-theme-change' custom event on toggle so checkout page
//            (and any other non-AppThemeProvider page) stays in sync
//          — listens for the same event so changes from checkout page sync back

'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type AppTheme = 'dark' | 'light';

interface ThemeCtx {
  theme:  AppTheme;
  toggle: () => void;
  isDark: boolean;
}

const Ctx = createContext<ThemeCtx>({ theme: 'light', toggle: () => {}, isDark: false });

// Read theme synchronously from <html> attr set by the blocking script in layout.tsx
// This avoids flash-of-wrong-theme and the "return null" delay on first render.
function getInitialTheme(): AppTheme {
  if (typeof document === 'undefined') return 'light'; // SSR — light is primary
  const attr = document.documentElement.getAttribute('data-app-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return 'light'; // fallback is always light — never dark
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme);

  useEffect(() => {
    // Sync in case localStorage has a value that differs from HTML attr
    const stored   = localStorage.getItem('asc-theme') as AppTheme | null;
    const explicit = localStorage.getItem('asc-theme-explicit');
    // Dark only if the user explicitly toggled it. Light is the default.
    const resolved: AppTheme =
      (stored === 'dark' && explicit === '1') ? 'dark' :
      (stored === 'light')                    ? 'light' :
                                                'light';
    setTheme(resolved);
    document.documentElement.setAttribute('data-app-theme', resolved);

    // Keep in sync if another component (e.g. checkout page) changes the theme
    const onThemeChange = () => {
      const attr = document.documentElement.getAttribute('data-app-theme') as AppTheme | null;
      if (attr === 'light' || attr === 'dark') setTheme(attr);
    };
    window.addEventListener('asc-theme-change', onThemeChange);
    return () => window.removeEventListener('asc-theme-change', onThemeChange);
  }, []);

  const toggle = () =>
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('asc-theme', next);
      // Mark as explicitly chosen by the user — distinguishes from old system default
      localStorage.setItem('asc-theme-explicit', '1');
      document.documentElement.setAttribute('data-app-theme', next);
      window.dispatchEvent(new Event('asc-theme-change'));
      return next;
    });

  // No more "if (!ready) return null" — theme is set synchronously from HTML attr
  return (
    <Ctx.Provider value={{ theme, toggle, isDark: theme === 'dark' }}>
      <div data-app-theme={theme} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function useAppTheme() {
  return useContext(Ctx);
}
