import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Aside, Banner, Title } from '@/components/rx/ui';
import { callsConfigured, monthlyMinutes, MONTHLY_FREE_MINUTES } from '@/lib/rx/calls';
import { CircleRow, FacilitatorManager } from '@/components/rx/admin/PeopleAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminCirclesPage() {
  try { await requireAdmin(); } catch { return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">Circles are managed by admins.</p></div></div>; }
  const [{ data: circles }, { data: seats }, { data: facs }] = await Promise.all([
    supabaseAdmin.from('circles').select('*').eq('is_demo', false).order('number'),
    supabaseAdmin.from('circle_seats').select('circle_id, role'),
    supabaseAdmin.from('member_profile').select('user_id').eq('is_facilitator', true).eq('is_demo', false),
  ]);
  const ids = ((facs ?? []) as { user_id: string }[]).map((f) => f.user_id);
  const { data: names } = ids.length ? await supabaseAdmin.from('member_directory').select('id, full_name').in('id', ids) : { data: [] };
  const facilitators = ((names ?? []) as { id: string; full_name: string | null }[]).map((n) => ({ id: n.id, name: n.full_name?.trim() || 'Member' }));
  const usage = await monthlyMinutes().catch(() => ({ used: 0, share: 0 }));
  const count = new Map<string, number>();
  for (const s of (seats ?? []) as { circle_id: string; role: string }[]) if (s.role === 'member') count.set(s.circle_id, (count.get(s.circle_id) ?? 0) + 1);

  return (
    <ToastProvider>
      <div className="rx rx-admin-desktop" style={{ padding: 4 }}>
        <p className="rx-sm">Community</p>
        <Title>Circles</Title>
        {!callsConfigured() && <div style={{ marginBottom: 16 }}><Banner error>Audio calls are off because DAILY_API_KEY is not set on the server. Members see “The call isn’t working right now.”</Banner></div>}
        {usage.share >= 0.8 && <div style={{ marginBottom: 16 }}><Banner>Call minutes this month: {usage.used.toLocaleString()} of the {MONTHLY_FREE_MINUTES.toLocaleString()} free allowance ({Math.round(usage.share * 100)}%).</Banner></div>}
        <div className="rx-two">
          <div className="rx-stack">
            {((circles ?? []) as Record<string, unknown>[]).map((c) => (
              <CircleRow key={c.id as string} facilitators={facilitators} c={{ id: c.id as string, name: c.name as string, number: c.number as number, status: c.status as string, members: count.get(c.id as string) ?? 0, facilitatorId: (c.facilitator_id as string | null) ?? null, cycleStart: (c.cycle_start as string | null) ?? null, dow: c.meeting_dow as number, time: (c.meeting_time as string).slice(0, 5) }} />
            ))}
            {(circles ?? []).length === 0 && <div className="rx-card rx-empty"><p className="rx-p">No Circles yet. They’re created automatically as members finish onboarding.</p></div>}
          </div>
          <Aside>
            <FacilitatorManager facilitators={facilitators} />
            <p className="rx-sm">Call minutes this month: {usage.used.toLocaleString()} of {MONTHLY_FREE_MINUTES.toLocaleString()} free.</p>
            <p className="rx-sm">Calls are audio by default. If anyone turns on a camera, Daily bills that call at the video rate, about four times the audio rate. The free minutes count the same either way.</p>
            <p className="rx-sm">New Circles are given a free facilitator when one exists. A Circle’s 90-day cycle starts when its 6th member joins.</p>
          </Aside>
        </div>
      </div>
    </ToastProvider>
  );
}
