export const dynamic = 'force-dynamic';

import AdminShell from '@/components/AdminShell';
import { AdminThemeProvider } from '@/components/AdminThemeProvider';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Permission } from '@/lib/permissions';
import '@/styles/admin-ledger.css';

// ═══════════════════════════════════════════════════════════
// Admin layout
// Lives at: app/admin/layout.tsx  ← this is the file Next.js's
// App Router actually loads for every route under /admin/*.
//
// CORRECTION (see git history / chat log): an earlier pass wired
// The Ledger design system into a file named app/admin/admin-layout.tsx,
// which looks like a layout but isn't one — Next.js only recognizes
// a file literally named layout.tsx as a route segment's layout.
// That file was never invoked, so none of the CSS/theme wiring was
// actually live. It has been deleted. This file is the real one.
//
// Auth gate for every /admin/* route.
//   1. Must be logged in              → otherwise /login
//   2. Must be admin or moderator     → otherwise /dashboard
//   3. Hydrates AdminShell with name, role, and permissions
//
// Permissions query has a two-step fallback: tries the full SELECT
// including `permissions` first; if that errors (most likely because
// the permissions column doesn't exist yet in this environment),
// retries with just `full_name, role` so the app still renders.
// Clean in the happy path, safe in the unmigrated path.
// ═══════════════════════════════════════════════════════════

// THE LEDGER — design system fonts, loaded once here so every page
// under /admin can use var(--ledger-font-serif) / var(--ledger-font-ui) /
// var(--ledger-font-mono) or the .ledger-* utility classes from
// styles/admin-ledger.css without re-importing anything per-page.
const LEDGER_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Syne:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Try the full query first (includes permissions).
  let profile: { full_name: string | null; role: string; permissions: Permission[] | null } | null = null;

  const fullQuery = await supabase
    .from('profiles')
    .select('full_name, role, permissions')
    .eq('id', user.id)
    .single();

  if (fullQuery.error) {
    // Most likely: permissions column doesn't exist yet in this env.
    // Retry with the core columns only so the app still renders.
    const fallback = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    if (fallback.data) {
      profile = { ...fallback.data, permissions: null };
    }
  } else {
    profile = fullQuery.data;
  }

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    redirect('/dashboard');
  }

  return (
    <>
      <link rel="stylesheet" href={LEDGER_FONTS_URL} />

      {/* Theme initialiser — mirrors the pattern in app/layout.tsx for
          the user-facing app's data-app-theme. Runs synchronously
          before paint so there's no flash from dark (the default) to
          whatever was last chosen. AdminThemeProvider's own effect
          re-confirms this value on mount; this script only prevents
          the first-paint flash. suppressHydrationWarning isn't needed
          here because this script runs inside <body>, not on <html>
          (admin doesn't own the root <html> tag — app/layout.tsx does). */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var stored = localStorage.getItem('ledger-theme');
                var explicit = localStorage.getItem('ledger-theme-explicit');
                var theme = (stored === 'light' && explicit === '1') ? 'light'
                          : (stored === 'dark') ? 'dark'
                          : 'dark';
                document.documentElement.setAttribute('data-ledger-theme', theme);
              } catch(e) {}
            })();
          `,
        }}
      />

      <AdminThemeProvider>
        <AdminShell
          name={profile.full_name || user.email || 'Admin'}
          role={profile.role}
          userPermissions={profile.permissions}
        >
          <div className="admin-wrapper">
            <style>{`
              .admin-wrapper table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
              .admin-wrapper .grid-cols-12 { min-width: 700px; }
              @media (max-width: 768px) {
                .admin-wrapper { padding: 0 4px; }
                .admin-wrapper h1 { font-size: 1.25rem !important; }
                .admin-wrapper button { white-space: nowrap; font-size: 0.75rem; }
                .admin-wrapper select { font-size: 0.75rem; }
              }
            `}</style>
            {children}
          </div>
        </AdminShell>
      </AdminThemeProvider>
    </>
  );
}
