export const dynamic = 'force-dynamic';

import AdminShell from '@/components/AdminShell';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    redirect('/dashboard');
  }

  return (
    <AdminShell name={profile.full_name || user.email || 'Admin'} role={profile.role}>
      <div className="admin-wrapper">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');

          .admin-wrapper {
            font-family: 'DM Sans', sans-serif;
          }

          /* ── Scrollable tables ── */
          .admin-wrapper table {
            display: block;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .admin-wrapper .grid-cols-12 { min-width: 700px; }

          /* ── Scrollbar styling — brand purple ── */
          .admin-wrapper ::-webkit-scrollbar { width: 5px; height: 5px; }
          .admin-wrapper ::-webkit-scrollbar-track { background: transparent; }
          .admin-wrapper ::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #6662FF, #A6A2FF);
            border-radius: 10px;
          }
          .admin-wrapper ::-webkit-scrollbar-thumb:hover { background: #6662FF; }

          /* ── Selection highlight — fuchsia ── */
          .admin-wrapper ::selection {
            background: rgba(253,129,253,0.25);
            color: inherit;
          }

          /* ── Focus rings — brand purple ── */
          .admin-wrapper :focus-visible {
            outline: 2px solid #6662FF;
            outline-offset: 2px;
          }

          /* ── Admin headings use Plus Jakarta Sans ── */
          .admin-wrapper h1,
          .admin-wrapper h2,
          .admin-wrapper h3 {
            font-family: 'Plus Jakarta Sans', sans-serif;
          }

          /* ── Responsive ── */
          @media (max-width: 768px) {
            .admin-wrapper { padding: 0 4px; }
            .admin-wrapper h1 { font-size: 1.35rem !important; }
            .admin-wrapper button { white-space: nowrap; font-size: 0.75rem; }
            .admin-wrapper select { font-size: 0.75rem; }
          }

          /* ── Fade-up animation ── */
          @keyframes admin-section-in {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .admin-wrapper > * {
            animation: admin-section-in 0.4s ease both;
          }
        `}</style>
        {children}
      </div>
    </AdminShell>
  );
}
