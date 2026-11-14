'use client';

// Sidebar / drawer button that switches the member app between light and dark (lib/theme.ts).

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { THEME_EVENT, getStoredTheme, setStoredTheme, type Theme } from '@/lib/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const read = () => setTheme(getStoredTheme());
    read();
    window.addEventListener(THEME_EVENT, read);
    return () => window.removeEventListener(THEME_EVENT, read);
  }, []);

  const dark = theme === 'dark';
  const label = dark ? 'Light mode' : 'Dark mode';

  return (
    <button
      type="button"
      className="sh-foot-btn sh-theme-btn"
      onClick={() => setStoredTheme(dark ? 'light' : 'dark')}
      aria-label={`Switch to ${label.toLowerCase()}`}
    >
      <span className="sh-item-icon" aria-hidden="true">{dark ? <Sun /> : <Moon />}</span>
      <span className="sh-foot-label">{label}</span>
    </button>
  );
}
