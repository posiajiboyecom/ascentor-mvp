'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type AppTheme = 'dark' | 'light';

interface ThemeCtx {
  theme:  AppTheme;
  toggle: () => void;
  isDark: boolean;
}

const Ctx = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {}, isDark: true });

// Read theme synchronously from <html> attr set by the blocking script in layout.tsx
// This avoids flash-of-wrong-theme and the "return null" delay on first render.
function getInitialTheme(): AppTheme {
  if (typeof document === 'undefined') return 'dark'; // SSR default
  const attr = document.documentElement.getAttribute('data-app-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return 'dark';
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme);

  useEffect(() => {
    // Sync in case localStorage has a value that differs from HTML attr
    const stored = localStorage.getItem('asc-theme') as AppTheme | null;
    const resolved = (stored === 'light' || stored === 'dark')
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(resolved);
    document.documentElement.setAttribute('data-app-theme', resolved);
  }, []);

  const toggle = () =>
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('asc-theme', next);
      document.documentElement.setAttribute('data-app-theme', next);
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
