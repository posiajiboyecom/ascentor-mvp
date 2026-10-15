import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Aside, Banner, Title } from '@/components/rx/ui';
import { circleState, type MentorPhase, type RoundPhase } from '@/lib/rx/circle-state';
import { circleTitle } from '@/lib/rx/circles';
import { callsConfigured } from '@/lib/rx/calls';
import { CommunityControls, LabCard, SeedControls, type LabCircle } from '@/components/rx/admin/DemoLab';
import { demoPostsExist } from '@/lib/rx/demo-community';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function DemoLabPage() {
  try { await requireAdmin(); } catch { return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">The Demo lab is for admins.</p></div></div>; }

  const { data: circles } = await supabaseAdmin.from('circles').select('id, name, number, interest, cycle_start, demo_call_until').eq('is_demo', true).order('number');
  const ids = ((circles ?? []) as { id: string }[]).map((c) => c.id);
  const [{ data: seats }, { data: rounds }, { data: votes }, { data: mentors }] = await Promise.all([
    ids.length ? supabaseAdmin.from('circle_seats').select('circle_id, role').in('circle_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabaseAdmin.from('circle_mentor_rounds').select('id, circle_id, status, closes_at').in('circle_id', ids).in('status', ['open', 'tie']) : Promise.resolve({ data: [] }),
    ids.length ? supabaseAdmin.from('circle_mentor_votes').select('round_id') : Promise.resolve({ data: [] }),
    ids.length ? supabaseAdmin.from('circle_mentors').select('circle_id, status, human_mentors(name)').in('circle_id', ids).in('status', ['requested', 'scheduling', 'active', 'paused']) : Promise.resolve({ data: [] }),
  ]);

  const lab: LabCircle[] = ((circles ?? []) as { id: string; name: string; number: number; interest: string | null; cycle_start: string | null; demo_call_until: string | null }[]).map((c) => {
    const members = ((seats ?? []) as { circle_id: string; role: string }[]).filter((s) => s.circle_id === c.id && s.role === 'member').length;
    const round = ((rounds ?? []) as { id: string; circle_id: string; status: 'open' | 'tie'; closes_at: string }[]).find((r) => r.circle_id === c.id);
    const mentor = ((mentors ?? []) as unknown as { circle_id: string; status: MentorPhase; human_mentors: { name: string } | null }[]).find((m) => m.circle_id === c.id);
    const state = circleState({
      members, started: !!c.cycle_start, round: (round?.status as RoundPhase) ?? null, roundClosesAt: round?.closes_at ?? null,
      votesCast: round ? ((votes ?? []) as { round_id: string }[]).filter((v) => v.round_id === round.id).length : 0,
      mentorPhase: (mentor?.status as MentorPhase) ?? null, mentorName: mentor?.human_mentors?.name ?? null,
    });
    const ready = !!c.cycle_start && members >= 6;
    const phase: LabCircle['phase'] = !ready ? 'forming' : round ? 'voting' : mentor?.status === 'requested' ? 'requested' : mentor?.status === 'scheduling' ? 'scheduling' : mentor ? 'active' : 'ready';
    return { id: c.id, title: circleTitle(c), members, headline: state.headline, detail: state.detail, phase, callOpen: !!c.demo_call_until && new Date(c.demo_call_until).getTime() > Date.now() };
  });

  const hasPosts = lab.length > 0 ? await demoPostsExist(supabaseAdmin) : false;

  return (
    <ToastProvider>
      <div className="rx rx-admin-desktop" style={{ padding: 4 }}>
        <p className="rx-sm">Community</p>
        <Title>Demo lab</Title>
        {!callsConfigured() && <div style={{ marginBottom: 16 }}><Banner>Calls can’t carry sound until DAILY_API_KEY is set. The call window will still open so you can see the screen.</Banner></div>}
        <div className="rx-two">
          <div className="rx-stack">
            <SeedControls hasDemo={lab.length > 0} />
            {lab.length > 0 && <CommunityControls hasPosts={hasPosts} />}
            {lab.map((c) => <LabCard key={c.id} c={c} />)}
          </div>
          <Aside>
            <p className="rx-label">How to test</p>
            <p className="rx-p">Open Circles, then Find a Circle. Demo Circles appear there for staff only.</p>
            <p className="rx-p">Join one, then use the buttons here to move it forward: open a vote, vote, close it, accept the mentor, book a time, open the call.</p>
            <p className="rx-sm">Demo members never get email or push. Real members, including you, get the in-app notification and email for each step, so you can check what they receive.</p>
          </Aside>
        </div>
      </div>
    </ToastProvider>
  );
}
