'use client';

// Keeps <html data-app-theme> right as the member moves around: dark only on member app
// pages (lib/theme.ts), light everywhere else. The first paint is handled by the inline
// script in the root layout; this covers client-side navigation and changes made in
// Settings or in another tab.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { THEME_EVENT, THEME_KEY, applyTheme } from '@/lib/theme';

export default function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => applyTheme(window.location.pathname);
    sync();
    const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY) sync(); };
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, [pathname]);

  return null;
}
