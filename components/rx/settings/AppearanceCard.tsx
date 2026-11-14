'use client';

// Settings > Account: light or dark theme, kept on this device (lib/theme.ts).

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { THEME_EVENT, getStoredTheme, setStoredTheme, type Theme } from '@/lib/theme';

export default function AppearanceCard() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const read = () => setTheme(getStoredTheme());
    read();
    window.addEventListener(THEME_EVENT, read);
    return () => window.removeEventListener(THEME_EVENT, read);
  }, []);

  const pick = (t: Theme) => { setTheme(t); setStoredTheme(t); };

  return (
    <div className="rx-card st">
      <p className="rx-sl">Appearance</p>
      <p className="rx-sm">Choose how Ascentor looks on this device.</p>
      <div className="rx-row" role="group" aria-label="Theme">
        <button type="button" className="rx-opt" aria-pressed={theme === 'light'} onClick={() => pick('light')}><Sun aria-hidden style={{ width: 16, height: 16 }} />Light</button>
        <button type="button" className="rx-opt" aria-pressed={theme === 'dark'} onClick={() => pick('dark')}><Moon aria-hidden style={{ width: 16, height: 16 }} />Dark</button>
      </div>
    </div>
  );
}
