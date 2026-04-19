// ═══════════════════════════════════════════════════════════
// Admin overview page
// Drop in: app/admin/page.tsx
//
// Thin server wrapper — all rendering logic lives in
// AdminOverviewClient. Auth is enforced by the parent
// layout.tsx, so we don't need a session check here.
// ═══════════════════════════════════════════════════════════
import AdminOverviewClient from './AdminOverviewClient';

export default function AdminOverviewPage() {
  return <AdminOverviewClient />;
}
