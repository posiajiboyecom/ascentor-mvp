import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';
import { requireAdmin } from '@/lib/rx/admin';
import { createClient } from '@/lib/supabase/server';
import AnnouncementsAdmin, { type AdminAnn } from '@/components/rx/admin/AnnouncementsAdmin';
import { Title } from '@/components/rx/ui';

export const dynamic = 'force-dynamic';

export default async function AdminAnnouncementsPage() {
  try { await requireAdmin(); } catch { return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">Announcements are managed by admins.</p></div></div>; }
  const db = await createClient();
  const { data } = await db.from('announcements').select('*').order('created_at', { ascending: false });
  const initial: AdminAnn[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string, title: r.title as string, text: (r.text as string) ?? '', date_label: (r.date_label as string) ?? '', time_label: (r.time_label as string) ?? '',
    location: (r.location as string) ?? '', btn_label: (r.btn_label as string) ?? '', link: (r.link as string) ?? '', image_url: (r.image_url as string | null) ?? null,
    audience: r.audience as string, aud_value: (r.aud_value as string) ?? '', banner: !!r.banner, featured: !!r.featured,
    starts_on: (r.starts_on as string) ?? '', ends_on: (r.ends_on as string) ?? '', status: r.status as AdminAnn['status'],
  }));

  return (
    <ToastProvider>
      <div className="rx" style={{ padding: 4 }}>
        <p className="rx-sm">Community</p>
        <Title>Announcements</Title>
        {initial.length ? <AnnouncementsAdmin initial={initial} /> : <AnnouncementsAdmin initial={[{ id: '', title: 'New announcement', text: '', date_label: '', time_label: '', location: '', btn_label: 'Learn more', link: '', image_url: null, audience: 'All members', aud_value: '', banner: false, featured: false, starts_on: '', ends_on: '', status: 'Draft' }]} />}
      </div>
    </ToastProvider>
  );
}
