'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type AppTheme = 'dark' | 'light';

interface ThemeCtx {
  theme:  AppTheme;
  toggle: () => void;
  isDark: boolean;
}

const Ctx = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {}, isDark: true });

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('asc-theme') as AppTheme | null;
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    } else {
      setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    setReady(true);
  }, []);

  const toggle = () =>
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('asc-theme', next);
      return next;
    });

  if (!ready) return null;

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
