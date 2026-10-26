import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Aside, Title } from '@/components/rx/ui';
import CategoriesAdmin, { type CategoryRow } from '@/components/rx/admin/CategoriesAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  try { await requireAdmin(); } catch { return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">Categories are managed by admins.</p></div></div>; }
  const [{ data: cats }, { data: posts }] = await Promise.all([
    supabaseAdmin.from('feed_categories').select('slug, name, active, position').order('position'),
    supabaseAdmin.from('feed_posts').select('category').eq('deleted', false),
  ]);
  const n = new Map<string, number>();
  for (const p of (posts ?? []) as { category: string | null }[]) if (p.category) n.set(p.category, (n.get(p.category) ?? 0) + 1);
  const rows: CategoryRow[] = ((cats ?? []) as { slug: string; name: string; active: boolean }[]).map((c) => ({ slug: c.slug, name: c.name, active: c.active, posts: n.get(c.name) ?? 0 }));
  return (
    <ToastProvider>
      <div className="rx" style={{ padding: 16 }}>
        <p className="rx-sm">Community</p>
        <Title>Categories</Title>
        <div className="rx-two">
          <CategoriesAdmin rows={rows} />
          <Aside>
            <p className="rx-label">How categories work</p>
            <p className="rx-p">Members pick one category when they post, and filter the feed by it.</p>
            <p className="rx-sm">Renaming moves existing posts with it. Hiding a category removes it from the post form but keeps old posts and the filter chip hidden, and you can show it again any time.</p>
          </Aside>
        </div>
      </div>
    </ToastProvider>
  );
}
