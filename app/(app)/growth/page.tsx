// app/(app)/growth/page.tsx
// My Growth: the member's own survey scores over time (baseline, 3 months, 6 months) and this cycle's progress.
// Private: nobody else sees these, and nobody is compared with anyone.

import { redirect } from 'next/navigation';
import { Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from '@/lib/rx/server';
import { cycleSummary } from '@/lib/rx/circle';
import { addDays, localISODate } from '@/lib/rx/dates';
import { loadScores } from '@/lib/rx/survey';
import { Aside, BackLink, Bar, Page, Title } from '@/components/rx/ui';
import { BeyondSelfEditor, RetakeSurvey } from '@/components/rx/growth/GrowthClient';

export const dynamic = 'force-dynamic';

type Score = { kind: 'baseline' | 'm3' | 'm6'; flourishing: number; purpose: number; initiative: number; taken_at: string };
const METRICS: { key: 'flourishing' | 'purpose' | 'initiative'; name: string }[] = [
  { key: 'flourishing', name: 'Flourishing' }, { key: 'purpose', name: 'Purpose' }, { key: 'initiative', name: 'Initiative' },
];
const pos = (v: number) => `${Math.round(((v - 1) / 4) * 100)}%`;

export default async function GrowthPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const db = await createClient();
  const circle = await getMyCircle();
  const [scoreMap, sum, { data: threads }] = await Promise.all([
    loadScores(me.userId),
    circle ? cycleSummary(me.userId, circle.circle.id, circle.circle.cycle_start) : Promise.resolve(null),
    db.from('dm_threads').select('id').eq('status', 'accepted').gte('last_message_at', addDays(localISODate(me.tz), -30)),
  ]);
  const base = scoreMap.get('baseline') as Score | undefined;
  const m3 = scoreMap.get('m3') as Score | undefined;
  const m6 = scoreMap.get('m6') as Score | undefined;

  // Survey schedule: 3 months and 6 months after the baseline.
  const dueFor = (months: number) => (base ? new Date(new Date(base.taken_at).setMonth(new Date(base.taken_at).getMonth() + months)) : null);
  const next = !base ? null : !m3 ? { kind: 'm3', due: dueFor(3) } : !m6 ? { kind: 'm6', due: dueFor(6) } : null;
  const available = !!next && !!next.due && next.due.getTime() - 14 * 86400000 <= Date.now();
  const dueLabel = next?.due ? `The next survey opens around ${next.due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.` : 'You’ve completed all three.';
  const sixLabel = dueFor(6)?.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) ?? '';

  // Most movement between the baseline and the latest survey.
  const latest = m6 ?? m3;
  let moved = '';
  if (base && latest) {
    const best = METRICS.map((m) => ({ ...m, d: latest[m.key] - base[m.key] })).sort((a, b) => b.d - a.d)[0];
    if (best && best.d > 0) moved = `What moved most: ${best.name.toLowerCase()}, from ${Number(base[best.key]).toFixed(1)} to ${Number(latest[best.key]).toFixed(1)}.`;
    else moved = 'Scores moved little this time. That’s information, not a verdict.';
  }

  // Peers: Circle-mates once meetings are running, plus people met through accepted direct messages this month.
  const peers = (circle && circle.circle.cycle_start ? Math.max(0, circle.memberCount - 1) : 0) + (threads?.length ?? 0);
  const keptLabel = sum && sum.setCount ? `${sum.keptCount} of ${sum.setCount} kept` : 'Nothing set yet';
  const keptPct = sum && sum.setCount ? Math.round((sum.keptCount / sum.setCount) * 100) : 0;

  return (
    <Page>
      <BackLink href="/profile">Profile</BackLink>
      <Title>My Growth</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          <div className="rx-card rx-stack">
            <div className="rx-between"><p className="rx-label">Your survey, over time</p><span className="rx-sm">1 to 5</span></div>
            {!base ? (
              <p className="rx-p">Your baseline survey isn’t recorded yet. Finish it from onboarding to see your growth here.</p>
            ) : (
              <>
                <div className="rx-row" style={{ gap: 16, fontSize: 13, color: 'var(--rx-muted)' }}>
                  <span className="rx-row" style={{ gap: 6 }}><i className="rx-lg0" />Baseline</span>
                  <span className="rx-row" style={{ gap: 6 }}><i className="rx-lg3" />3 months</span>
                  <span className="rx-row" style={{ gap: 6 }}><i className="rx-lg6" />6 months, due {sixLabel}</span>
                </div>
                {METRICS.map((m) => (
                  <div key={m.key} className="rx-stack-sm">
                    <div className="rx-between"><span className="rx-h3">{m.name}</span><span className="rx-sm">{[base, m3, m6].filter(Boolean).map((s) => Number((s as Score)[m.key]).toFixed(1)).join(' → ')}</span></div>
                    <div className="rx-chart" role="img" aria-label={`${m.name}: baseline ${Number(base[m.key]).toFixed(1)}${m3 ? `, 3 months ${Number(m3[m.key]).toFixed(1)}` : ''}${m6 ? `, 6 months ${Number(m6[m.key]).toFixed(1)}` : ', 6 months not yet taken'}`}>
                      <span className="ln" />
                      {[0, 25, 50, 75, 100].map((t) => <span key={t} className="tick" style={{ left: `${t}%` }} />)}
                      <span className="pt0" style={{ left: pos(Number(base[m.key])) }} />
                      {m3 && <span className="pt3" style={{ left: pos(Number(m3[m.key])) }} />}
                      {m6 ? <span className="pt3" style={{ left: pos(Number(m6[m.key])), background: 'var(--rx-gold)' }} /> : <span className="pt6" style={{ left: '88%' }} />}
                    </div>
                  </div>
                ))}
                {moved && <p className="rx-p">{moved}</p>}
              </>
            )}
          </div>
          <p className="rx-row rx-nw rx-sm" style={{ gap: 8 }}><Lock aria-hidden style={{ width: 16, height: 16 }} />Your answers are private. No one is compared with you.</p>
          {base && <RetakeSurvey dueLabel={dueLabel} available={available} />}
        </div>
        <Aside>
          <p className="rx-label">This cycle</p>
          <div className="rx-between"><span>Practices set and kept</span><span className="rx-strong">{keptLabel}</span></div>
          <Bar pct={keptPct} label={keptLabel} />
          <div className="rx-between"><span>Goals met</span><span className="rx-strong">{sum ? `${sum.goalsMet} of ${sum.goalsTotal || 3}` : '-'}</span></div>
          <div className="rx-between"><span>Purposeful peers met this month</span><span className="rx-strong">{peers}</span></div>
          <p className="rx-label">Beyond-self project</p>
          <BeyondSelfEditor initial={me.profile?.beyond_self_project ?? ''} since={me.profile?.beyond_self_since ?? null} />
        </Aside>
      </div>
    </Page>
  );
}
