import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Aside, Title } from '@/components/rx/ui';
import { MentorForm } from '@/components/rx/admin/PeopleAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminHumanMentorsPage() {
  try { await requireAdmin(); } catch { return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">Mentors are managed by admins.</p></div></div>; }
  const { data } = await supabaseAdmin.from('human_mentors').select('*').order('created_at');
  const rows = (data ?? []) as Record<string, unknown>[];

  return (
    <ToastProvider>
      <div className="rx" style={{ padding: 16 }}>
        <p className="rx-sm">Community</p>
        <Title>Mentors</Title>
        <div className="rx-two">
          <div className="rx-stack">
            {rows.map((m) => (
              <MentorForm key={m.id as string} initial={{ id: m.id as string, name: m.name as string, headline: (m.headline as string) ?? '', bio: (m.bio as string) ?? '', tags: (m.tags as string[]).join(', '), langs: (m.langs as string[]).join(', '), formats: (m.formats as string[]).join(', '), capacity: m.capacity as number, accepting: !!m.accepting, active: !!m.active }} />
            ))}
            {rows.length === 0 && <div className="rx-card rx-empty"><p className="rx-p">No mentors yet. Add the first one.</p></div>}
          </div>
          <Aside>
            <MentorForm isNew initial={{ email: '', name: '', headline: '', bio: '', tags: '', langs: 'English', formats: 'Video', capacity: 3, accepting: true, active: true }} />
            <p className="rx-sm">These are people who mentor members one to one. The AI coach personas are under Mentors in the content section. Mentors add their open times from Sessions, in the mentor view.</p>
          </Aside>
        </div>
      </div>
    </ToastProvider>
  );
}
