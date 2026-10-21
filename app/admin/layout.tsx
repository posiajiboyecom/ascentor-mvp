export const dynamic = 'force-dynamic';

import AdminShell from '@/components/AdminShell';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getStaff } from '@/lib/admin/access';
import { getBadges } from '@/lib/admin/badges';
import { listStaff } from '@/lib/admin/staff';
import { AREA_KEYS, can, legacyAreaFor, areaOf } from '@/lib/admin/areas';
import { adminMfaRequired, sessionIsAal2 } from '@/lib/auth/admin-mfa';
import '@/styles/admin-ledger.css';
import '@/styles/admin-console.css';

// ═══════════════════════════════════════════════════════════
// Admin layout
// Lives at: app/admin/layout.tsx  ← this is the file Next.js's
// App Router actually loads for every route under /admin/*.
//
// CORRECTION (see git history / chat log): an earlier pass wired
// The Ledger design system into a file named app/admin/admin-layout.tsx,
// which looks like a layout but isn't one, Next.js only recognizes
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

// THE LEDGER, typography is Metropolis, loaded locally via @font-face
// in globals.css (public/fonts/metropolis/). The previous Google Fonts
// link (Cormorant Garamond / Syne / DM Mono) was removed, none of those
// families are referenced by the Ledger tokens anymore.

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin-login');

  // Who is this teammate and what may their role open? (lib/admin/access.ts: the role is data, the server enforces it.)
  const staff = await getStaff();
  if (!staff) redirect('/dashboard');

  // Second factor: when ADMIN_MFA_REQUIRED=true, a password-only session is not enough.
  if (adminMfaRequired() && !(await sessionIsAal2(supabase))) {
    redirect('/admin-login?mfa=1&redirect=/admin');
  }

  // Older pages (/admin/<legacy>) fetch their data on the server: refuse here, before the page is rendered, when the REAL role
  // has no access to the matching area. Console pages (/admin/c/*) and Overview enforce their own level with requireArea.
  const pathname = (await headers()).get('x-pathname');
  const legacyArea = legacyAreaFor(pathname);
  const blocked = !!legacyArea && !can(staff.level(legacyArea), 'view');

  // The menu shows what the PREVIEW role can open (an admin may be viewing as a teammate); pages and actions check the real role.
  const visibleAreas = AREA_KEYS.filter((k) => can(staff.uiLevel(k), 'view'));
  const [badges, team] = await Promise.all([
    getBadges(visibleAreas),
    staff.isAdmin ? listStaff(staff.userId) : Promise.resolve([]),
  ]);

  return (
    <>
      <div data-ledger data-ledger-theme="light" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AdminShell
          name={staff.name}
          role={staff.roleId}
          email={staff.email}
          avatarUrl={staff.avatarUrl}
          roleName={staff.roleName}
          visibleAreas={visibleAreas}
          badges={badges}
          isAdmin={staff.isAdmin}
          viewAsOptions={team.filter((m) => !m.isSelf).map((m) => ({ id: m.id, label: `${m.name} · ${m.roleName}` }))}
          viewingAsId={staff.viewingAs?.id ?? null}
        >
          <div className="admin-wrapper">
            <style>{`
              /* ── Global admin mobile fixes ─────────────────────────── */

              /* Tables: always scrollable */
              .admin-wrapper table {
                display: block;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                width: 100%;
              }
              .admin-wrapper .grid-cols-12 { min-width: 700px; }

              /* Stat/metric grids: 2-up on mobile */
              .admin-wrapper .admin-stat-grid {
                display: grid !important;
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 10px !important;
              }

              @media (max-width: 768px) {
                /* Layout */
                .admin-wrapper { padding: 0; }

                /* Typography */
                .admin-wrapper h1 { font-size: 1.25rem !important; }
                .admin-wrapper h2 { font-size: 1.05rem !important; }

                /* Buttons & inputs */
                .admin-wrapper button { white-space: nowrap; font-size: 0.75rem; }
                .admin-wrapper select, .admin-wrapper input { font-size: 0.875rem !important; }

                /* Tab bars: scroll horizontally instead of overflowing */
                .admin-wrapper [style*="width: 'fit-content'"],
                .admin-wrapper [style*="width:fit-content"],
                .admin-wrapper [style*="width: fit-content"] {
                  width: 100% !important;
                  overflow-x: auto !important;
                }

                /* Flex rows that should wrap on mobile */
                .admin-wrapper .asc-row,
                .admin-wrapper .admin-header-row {
                  flex-wrap: wrap !important;
                  gap: 8px !important;
                }

                /* Two-column grids → single column */
                .admin-wrapper [class*="grid-cols-2"] { grid-template-columns: 1fr !important; }
                .admin-wrapper [class*="grid-cols-3"] { grid-template-columns: 1fr 1fr !important; }
                .admin-wrapper [class*="grid-cols-4"] { grid-template-columns: 1fr 1fr !important; }

                /* Inline flex layouts with fixed widths → full width */
                .admin-wrapper .ascentor-layout { flex-direction: column !important; }
                .admin-wrapper .pm-wrap { flex-direction: column !important; }

                /* Sticky sidebars inside pages → static on mobile */
                .admin-wrapper [style*="position: sticky"],
                .admin-wrapper [style*="position:'sticky'"] {
                  position: static !important;
                }

                /* Cards: reduce padding */
                .admin-wrapper [style*="padding: 28"],
                .admin-wrapper [style*="padding: 32"],
                .admin-wrapper [style*="padding: '28px'"],
                .admin-wrapper [style*="padding: '32px'"] {
                  padding: 16px !important;
                }

                /* Fixed pixel widths on inputs → full width */
                .admin-wrapper input[style*="width: '260px'"],
                .admin-wrapper input[style*="width: 260px"] {
                  width: 100% !important;
                }

                /* Horizontal scroll containers */
                .admin-wrapper .asc-table-wrap,
                .admin-wrapper [style*="overflow-x: auto"] {
                  overflow-x: auto !important;
                  -webkit-overflow-scrolling: touch;
                }

                /* Modal / overlay widths */
                .admin-wrapper [style*="maxWidth: 480"],
                .admin-wrapper [style*="maxWidth: 400"],
                .admin-wrapper [style*="maxWidth: 380"],
                .admin-wrapper [style*="max-width: 480px"],
                .admin-wrapper [style*="max-width: 400px"],
                .admin-wrapper [style*="max-width: 380px"] {
                  max-width: calc(100vw - 32px) !important;
                }

                /* Hide non-essential desktop columns in tables */
                .admin-wrapper .td-hide-mobile { display: none !important; }

                /* Pill/tag tab bars: wrap not overflow */
                .admin-wrapper .asc-tabs { flex-wrap: nowrap; overflow-x: auto; }

                /* Reduce chart containers */
                .admin-wrapper [style*="height: '300px'"],
                .admin-wrapper [style*="height: 300px"] {
                  height: 200px !important;
                }
              }

              @media (max-width: 480px) {
                /* Stat grids → 2 columns on very narrow */
                .admin-wrapper .admin-stat-grid {
                  grid-template-columns: 1fr 1fr !important;
                }

                /* Single-column forms */
                .admin-wrapper form .grid,
                .admin-wrapper .form-grid {
                  grid-template-columns: 1fr !important;
                }
              }
            `}</style>
            {blocked ? (
              <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 8 }}>No access</h1>
                <p style={{ opacity: 0.7, maxWidth: 420, margin: '0 auto' }}>
                  Your role does not include {areaOf(legacyArea!)?.label ?? 'this area'}. Ask an admin if you need it.
                </p>
              </div>
            ) : children}
          </div>
        </AdminShell>
      </div>
    </>
  );
}
