// FILE: components/AdminThemeProvider.tsx
// THE LEDGER — theme provider for /admin, parallel to AppThemeProvider.tsx
// but scoped under data-ledger / data-ledger-theme instead of
// data-app-theme, so admin theming can never collide with the
// user-facing app's theme state even though both can be open in
// adjacent tabs against the same session.
//
// Default is LIGHT ("Summit White") — matches the user-facing app's
// default theme (see components/AppThemeProvider.tsx), per Anifie's
// call to keep the admin and app primary themes aligned. Dark
// ("Summit Black") remains available and is the explicit opt-in via
// the toggle in AdminShell, same UX shape as the app's own toggle.

'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type LedgerTheme = 'dark' | 'light';

interface LedgerThemeCtx {
  theme:  LedgerTheme;
  toggle: () => void;
  isDark: boolean;
}

const Ctx = createContext<LedgerThemeCtx>({ theme: 'light', toggle: () => {}, isDark: false });

// Read synchronously from <html> attr set by the blocking script in
// app/admin/layout.tsx — avoids flash-of-wrong-theme on first paint.
function getInitialTheme(): LedgerTheme {
  if (typeof document === 'undefined') return 'light'; // SSR — light is primary for admin
  const attr = document.documentElement.getAttribute('data-ledger-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return 'light';
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<LedgerTheme>(getInitialTheme);

  useEffect(() => {
    const stored   = localStorage.getItem('ledger-theme') as LedgerTheme | null;
    const explicit = localStorage.getItem('ledger-theme-explicit');
    // Dark only if the admin explicitly chose it. Light is the default.
    const resolved: LedgerTheme =
      (stored === 'dark' && explicit === '1') ? 'dark'  :
      (stored === 'light')                    ? 'light' :
                                                 'light';
    setTheme(resolved);
    document.documentElement.setAttribute('data-ledger-theme', resolved);

    const onThemeChange = () => {
      const attr = document.documentElement.getAttribute('data-ledger-theme') as LedgerTheme | null;
      if (attr === 'light' || attr === 'dark') setTheme(attr);
    };
    window.addEventListener('ledger-theme-change', onThemeChange);
    return () => window.removeEventListener('ledger-theme-change', onThemeChange);
  }, []);

  const toggle = () =>
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ledger-theme', next);
      localStorage.setItem('ledger-theme-explicit', '1');
      document.documentElement.setAttribute('data-ledger-theme', next);
      window.dispatchEvent(new Event('ledger-theme-change'));
      return next;
    });

  return (
    <Ctx.Provider value={{ theme, toggle, isDark: theme === 'dark' }}>
      {/* suppressHydrationWarning is required here, same reasoning as
          <html> in app/layout.tsx: the blocking script in
          app/admin/layout.tsx sets data-ledger-theme on <html> BEFORE
          React hydrates, by reading localStorage — which doesn't
          exist during SSR. So the server always renders this div
          with the SSR fallback ('light'), while the client's first
          hydration pass can read a DIFFERENT value already written
          by the blocking script (e.g. 'dark', if that's what was
          saved). That mismatch is expected and intentional — it's
          what prevents a flash of the wrong theme — not a bug to
          "fix" by making the values match. Suppressing the warning
          here, scoped to this one div, is correct; do not add it
          higher up the tree where a real mismatch would be hidden. */}
      <div data-ledger data-ledger-theme={theme} suppressHydrationWarning
        style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function useAdminTheme() {
  return useContext(Ctx);
}
