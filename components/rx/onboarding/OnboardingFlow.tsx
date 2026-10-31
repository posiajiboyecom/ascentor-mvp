'use client';

// The 12-step onboarding flow: welcome, reminders, interests, where you are, goal, who it serves, weekly times,
// time zone, language, baseline survey, your starting point, and your Circle. Each step saves as you go.

import { useMemo, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Bell, Brain, Briefcase, CalendarDays, Check, Clock, Coins, Flag, Globe, Heart, Languages,
  MapPin, MessageSquare, Search, ShieldCheck, Sprout, User, Users, HeartHandshake,
} from 'lucide-react';
import {
  AGREE, INTEREST_GROUPS, LANGUAGES, LEAD_OPTIONS, OB_NEXT, OB_SAGE, OB_SEG, PROJ_OPTIONS, REASSURE,
  SLOT_OPTIONS, STAGE_COPY, SURVEY_QUESTIONS, WHO_SUGGEST, type ObStep, type Stage,
} from '@/lib/rx/constants';
import { detectedZone, searchZones, type TzInfo } from '@/lib/rx/timezones';
import { answerOpenHouse, finishOnboarding, recordChatConsent, saveOnboardingStep, type FinishResult, type OnboardingInput } from '@/app/onboarding/actions';
import { useToast } from '@/components/rx/Toast';
import { usePush } from '@/components/PushPermission';
import SageMark from '@/components/rx/SageMark';

export interface OnboardingInitial {
  step: ObStep;
  firstName: string;
  email: string | null;
  userId: string;
  alreadyCompleted: boolean;
  interests: string[];
  purpose: number | null;
  effort: number | null;
  lead: string | null;
  project: string | null;
  goals: { g: string; who: string }[];
  slots: string[];
  timezone: string | null;
  timezoneLabel: string | null;
  language: string | null;
  answers: (number | null)[];
}

type Step = ObStep | 'tzlist';

const DIM_ICON: Record<string, React.ReactNode> = {
  Mind: <Brain aria-hidden />, Character: <ShieldCheck aria-hidden />, Vocation: <Briefcase aria-hidden />,
  Finance: <Coins aria-hidden />, Relationships: <HeartHandshake aria-hidden />, Community: <Users aria-hidden />, Legacy: <Sprout aria-hidden />,
};

const FLOW: ObStep[] = ['welcome', 'notify', 'interests', 'timezone', 'slots', 'language', 'purpose', 'goal', 'serve', 'survey', 'stage', 'forming'];

export default function OnboardingFlow({ initial }: { initial: OnboardingInitial }) {
  const router = useRouter();
  const toast = useToast();
  const push = usePush();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<Step>(initial.step === 'forming' ? 'stage' : initial.step);
  const [error, setError] = useState('');
  // The Reminders step: `working` is the permission request in flight (separate from `pending`, which is a server save),
  // `note` is the short plain message shown when reminders could not be turned on.
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState('');
  const advancing = useRef(false);

  const [interests, setInterests] = useState<string[]>(initial.interests);
  const [purpose, setPurpose] = useState<number>(initial.purpose ?? 3);
  const [effort, setEffort] = useState<number>(initial.effort ?? 3);
  const [lead, setLead] = useState<string>(initial.lead ?? 'No');
  const [project, setProject] = useState<string>(initial.project ?? 'No');
  const [goals, setGoals] = useState<{ g: string; who: string }[]>(initial.goals.length ? initial.goals : [{ g: '', who: '' }]);
  const [gi, setGi] = useState(0);
  const [slots, setSlots] = useState<string[]>(initial.slots);
  const detected = useMemo(() => detectedZone(), []);
  const [tz, setTz] = useState<{ id: string; label: string; src: 'quick' | 'detected' | 'list' }>(() => {
    if (initial.timezone) return { id: initial.timezone, label: initial.timezoneLabel ?? initial.timezone, src: 'quick' };
    return { id: detected.id, label: `${detected.city}, ${detected.country} (${detected.off})`, src: 'detected' };
  });
  const [tzq, setTzq] = useState('');
  const [language, setLanguage] = useState<string>(initial.language ?? 'English');
  const [answers, setAnswers] = useState<(number | null)[]>(initial.answers.length ? initial.answers : SURVEY_QUESTIONS.map(() => null));
  const [sq, setSq] = useState(0);
  const [consent, setConsent] = useState(false);
  const [finish, setFinish] = useState<FinishResult | null>(null);
  const [ohChoice, setOhChoice] = useState<'pending' | 'joined' | 'later'>('pending');

  const idx = FLOW.indexOf(step as ObStep);
  const seg = OB_SEG[step as ObStep];

  const goal = goals[Math.min(gi, goals.length - 1)] ?? { g: '', who: '' };
  const setGoalField = (field: 'g' | 'who', v: string) =>
    setGoals((cur) => cur.map((x, i) => (i === Math.min(gi, cur.length - 1) ? { ...x, [field]: v } : x)));

  const canContinue =
    step === 'interests' ? interests.length > 0 :
    step === 'goal' ? goal.g.trim().length > 0 :
    step === 'survey' ? answers[sq] !== null :
    true;

  function save(s: ObStep, input: OnboardingInput, then: () => void) {
    setError('');
    start(async () => {
      const r = await saveOnboardingStep(s, input);
      if (!r.ok) { setError(r.error); return; }
      then();
    });
  }

  function complete(remindLater = false) {
    setError('');
    start(async () => {
      const s = await saveOnboardingStep('survey', { answers, remindLater });
      if (!s.ok) { setError(s.error); return; }
      const r = await finishOnboarding();
      if (!r.ok) { setError(r.error); return; }
      setFinish(r.result);
      if (!initial.alreadyCompleted && initial.email) {
        fetch('/api/welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: initial.email, name: initial.firstName, userId: initial.userId }) }).catch(() => {});
      }
      setStep('stage');
      if (remindLater) toast('Saved. We’ll remind you in 48 hours.');
    });
  }

  // Reminders step. The permission and push steps can hang (no service worker yet, a dialog nobody answers, an in-app browser
  // that never replies) or throw, so they are raced against a 5 second timer and never decide whether the member moves on:
  // whatever happens, the step is saved and the flow goes to the next one.
  function leaveReminders(choice: 'on' | 'off' | 'skipped') {
    if (advancing.current) return;
    advancing.current = true;
    try { window.localStorage.setItem('ascentor.reminders', choice); } catch { /* storage can be blocked */ }
    setError('');
    start(async () => {
      const r = await saveOnboardingStep('notify', {});
      advancing.current = false;
      setWorking(false);
      if (!r.ok) { setError(r.error); return; }
      setStep('interests');
    });
  }

  async function turnOnReminders() {
    if (working || pending || advancing.current) return;
    setWorking(true); setNote(''); setError('');
    let on = false;
    try {
      on = await Promise.race([
        push.subscribe().catch(() => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
      ]);
    } catch { on = false; }
    if (!on) {
      // Show the message for a moment, then carry on: the member should see why, not feel stuck.
      setNote('Reminders are off for now. You can turn them on later in Settings.');
      toast('Reminders are off for now. You can turn them on later in Settings.');
    }
    leaveReminders(on ? 'on' : 'off');
  }

  function skipReminders() {
    if (working || pending) return;
    leaveReminders('skipped');
  }

  function back() {
    if (step === 'tzlist') return setStep('timezone');
    if (step === 'survey' && sq > 0) return setSq(sq - 1);
    if (idx > 0) setStep(FLOW[idx - 1]);
  }

  function onContinue() {
    switch (step) {
      case 'welcome': {
        if (!consent) { setError('Please tick the box to continue.'); return; }
        setError('');
        start(async () => { const r = await recordChatConsent(); if (!r.ok) { setError(r.error); return; } setStep('notify'); });
        return;
      }
      case 'notify': return turnOnReminders();
      case 'interests': return save('interests', { interests }, () => setStep('timezone'));
      case 'purpose': return save('purpose', { purpose, effort, lead, project }, () => setStep('goal'));
      case 'goal': return save('goal', { goals }, () => setStep('serve'));
      case 'serve': return save('serve', { goals }, () => setStep('survey'));
      case 'timezone': return save('timezone', { timezone: tz.id, timezoneLabel: tz.label }, () => setStep('slots'));
      case 'slots': return save('slots', { slots }, () => setStep('language'));
      case 'tzlist': return setStep('timezone');
      case 'language': return save('language', { language }, () => setStep('purpose'));
      case 'survey':
        if (sq < SURVEY_QUESTIONS.length - 1) return setSq(sq + 1);
        return complete(false);
      case 'stage': return setStep('forming');
      default: return;
    }
  }

  const busy = pending || working;
  const continueLabel = step === 'notify' ? 'Turn on reminders' : step === 'tzlist' ? 'Back' : 'Continue';
  const footNote: Record<string, string> = {
    timezone: `Chosen: ${tz.label}`,
    tzlist: 'Pick a zone to return',
    interests: `${interests.length} chosen`,
    survey: `Question ${sq + 1} of ${SURVEY_QUESTIONS.length}`,
  };

  // ───────────────────────── welcome ─────────────────────────
  if (step === 'welcome') {
    return (
      <div className="rx rx-ob">
        <div className="rx-rise">
          <div className="rx-welcome">
            <div className="rx-welcome-art" aria-hidden>
              <Image src="/ascentor-LM-gold.svg" alt="" width={44} height={44} className="rx-welcome-logo" priority />
              <svg viewBox="0 0 390 420" preserveAspectRatio="xMidYMax slice" style={{ width: '100%', height: '100%' }}>
                <defs><radialGradient id="hz" cx="72%" cy="36%" r="62%"><stop offset="0" stopColor="#8A4B35" stopOpacity=".42" /><stop offset=".5" stopColor="#8A4B35" stopOpacity=".12" /><stop offset="1" stopColor="#8A4B35" stopOpacity="0" /></radialGradient></defs>
                <rect width="390" height="420" fill="url(#hz)" />
                <circle cx="290" cy="150" r="46" fill="#8A4B35" opacity=".75" />
                <path d="M0 196H390" stroke="#D6D3CB" strokeWidth="1.5" /><path d="M0 214H390" stroke="#D6D3CB" strokeWidth="1.5" opacity=".5" />
                {[[-10, 360, 100, 70], [90, 318, 100, 112], [190, 276, 100, 154], [290, 234, 110, 196]].map(([x, y, w, h], i) => (
                  <rect key={i} x={x} y={y} width={w} height={h} rx="6" fill="#FFFFFF" stroke="#D6D3CB" strokeWidth="1.5" />
                ))}
                {[[52, 318, '#3D6B7A'], [146, 274, '#8A4B35'], [238, 228, '#8A6A2B'], [330, 188, '#4E6B52']].map(([x, y, c], i) => (
                  <g key={i}><circle cx={x as number} cy={y as number} r="9" fill="#A8774F" /><rect x={(x as number) - 10} y={(y as number) + 10} width="20" height="32" rx="9" fill={c as string} /></g>
                ))}
              </svg>
            </div>
            <div className="rx-welcome-body">
              <p className="rx-sageline"><SageMark size={22} /><span><span className="sgl">Sage</span><span className="tx">Setup takes about two minutes.</span></span></p>
              <h1 className="rx-hero">Stop drifting.<br />Start becoming.</h1>
              <p className="rx-p" style={{ color: 'var(--rx-muted)', maxWidth: 440 }}>
                Small practices, a Circle that knows you, and mentors who show up. The daily home of The Elevation Summit.
              </p>
              <div className="rx-welcome-actions">
                <p className="rx-sm">Welcome, {initial.firstName}. Let’s set up your space.</p>
                <label className="rx-row rx-nw" style={{ gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setError(''); }} style={{ width: 20, height: 20, marginTop: 2, accentColor: '#0F0F0E', flex: 'none' }} />
                  <span className="rx-sm" style={{ color: 'var(--rx-ink)' }}>I understand that the Ascentor team can read chats on the platform, including conversations with Sage, to keep members safe and to improve Ascentor. Other members cannot read my chats. <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rx-gold)', fontWeight: 700 }}>Privacy policy</a></span>
                </label>
                {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
                <button type="button" className="rx-btn primary block" disabled={pending} onClick={onContinue}>{pending ? 'Saving…' : 'Get started'}<ArrowRight aria-hidden style={{ width: 18, height: 18 }} /></button>
                <p className="rx-sm" style={{ textAlign: 'center' }}>Other members never see your answers or your chats with Sage.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────── stage reveal ─────────────────────────
  if (step === 'stage') {
    const stage: Stage = finish?.stage ?? 'Building';
    return (
      <div className="rx rx-ob">
        <div className="rx-stage rx-rise">
          <div className="rx-stage-art" aria-hidden>
            <svg viewBox="0 0 360 260" style={{ width: '100%', maxWidth: 420 }}>
              <path d="M0 260 Q90 165 180 182 T360 70 V260Z" fill="#F1EBDD" />
              <path d="M0 260 Q120 210 220 228 T360 200 V260Z" fill="#E8E0CC" />
              <path d="M232 146 C262 124 296 100 330 72" stroke="#D6D3CB" strokeWidth="2" strokeDasharray="4 7" strokeLinecap="round" fill="none" />
              <path d="M28 252 C88 236 108 206 150 194 S206 168 232 146" stroke="#0F0F0E" strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="420" style={{ animation: 'rx-draw 1.6s ease-out both' }} />
              <circle cx="232" cy="132" r="34" fill="#8A4B35" opacity=".2" /><circle cx="232" cy="132" r="18" fill="#8A4B35" opacity=".28" />
              <rect x="222" y="112" width="20" height="26" rx="5" fill="#fff" stroke="#8A6A2B" strokeWidth="1.5" />
              <ellipse cx="232" cy="126" rx="4" ry="6" fill="#8A4B35" />
              <circle cx="330" cy="72" r="4" fill="#B8B3A6" />
            </svg>
          </div>
          <div className="rx-stage-body">
            <p className="rx-sageline"><SageMark size={22} /><span><span className="sgl">Sage</span><span className="tx">Here’s where your path begins.</span></span></p>
            <p className="rx-label">Your starting point</p>
            <h1 className="rx-hero">{stage}</h1>
            <span className="rx-rule" style={{ margin: 0 }} />
            <p className="rx-p" style={{ fontSize: 18, maxWidth: 460 }}>{STAGE_COPY[stage]}</p>
            <p className="rx-sm" style={{ maxWidth: 460 }}>This is a place to start, not a score. It moves as you grow.</p>
            <div style={{ marginTop: 12 }}><button type="button" className="rx-btn primary" onClick={onContinue}>Continue</button></div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────── Circle + Open house ─────────────────────────
  if (step === 'forming') {
    const c = finish?.circle ?? null;
    const need = Math.max(0, 6 - (c?.members ?? 0));
    return (
      <div className="rx rx-ob">
        <div className="rx-stage rx-rise">
          <div className="rx-stage-art" aria-hidden>
            <svg viewBox="0 0 300 230" style={{ width: '100%', maxWidth: 340 }}>
              <ellipse cx="150" cy="118" rx="78" ry="48" fill="#fff" stroke="#D6D3CB" strokeWidth="1.5" />
              <circle cx="150" cy="118" r="10" fill="#8A4B35" opacity=".7" />
              {[[150, 46, '#8A4B35'], [222, 66, '#3D6B7A'], [250, 118, '#4E6B52'], [222, 170, '#6A5688']].map(([x, y, col], i) => <circle key={i} cx={x as number} cy={y as number} r="15" fill={col as string} />)}
              {[[150, 190], [78, 170], [50, 118], [78, 66]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="15" fill="none" stroke="#B8B3A6" strokeWidth="1.5" strokeDasharray="4 4" />)}
            </svg>
          </div>
          <div className="rx-stage-body">
            <p className="rx-sageline"><SageMark size={22} /><span><span className="sgl">Sage</span><span className="tx">You’re in. Say hello when you’re ready.</span></span></p>
            <h1 className="rx-title">Meet your Circle</h1><span className="rx-rule" style={{ margin: 0 }} />
            {c ? (
              <>
                <p className="rx-p" style={{ maxWidth: 460 }}>You’ve joined {c.name}. Your group chat is open now.</p>
                <p className="rx-sm">{need > 0 ? `Meetings start when 4 members have joined. ${c.members} of 4 so far.` : 'Your Circle has 4 or more members, so meetings begin this week.'}</p>
              </>
            ) : (
              <p className="rx-p" style={{ maxWidth: 460 }}>We’re setting up your Circle. It will appear on the Circle tab as soon as it’s ready.</p>
            )}

            {ohChoice === 'pending' && (
              <div className="rx-card rx-stack-sm rx-rise" style={{ maxWidth: 460 }}>
                <div className="rx-row rx-nw">
                  <span className="rx-dimdot"><MessageSquare aria-hidden /></span>
                  <div style={{ minWidth: 0 }}><p className="rx-p rx-strong">You’re invited to Open house</p><p className="rx-sm">A general group for every member. Say hello, ask anything.</p></div>
                </div>
                <p className="rx-sm">{finish?.openHouseMembers ?? 0} members</p>
                <div className="rx-row">
                  <button type="button" className="rx-btn secondary" disabled={pending}
                    onClick={() => start(async () => { const r = await answerOpenHouse(true); if (r.ok) setOhChoice('joined'); else setError(r.error); })}>Join</button>
                  <button type="button" className="rx-link" disabled={pending}
                    onClick={() => start(async () => { const r = await answerOpenHouse(false); if (r.ok) { setOhChoice('later'); toast('No problem. Open house is in Groups any time.'); } else setError(r.error); })}>Not now</button>
                </div>
              </div>
            )}
            {ohChoice === 'joined' && <p className="rx-row rx-nw rx-p rx-rise" style={{ gap: 8 }}><Check aria-hidden style={{ width: 18, height: 18, color: 'var(--rx-gold)' }} />You joined Open house.</p>}
            {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
            <div style={{ marginTop: 8 }}>
              <button type="button" className="rx-btn primary" onClick={() => router.push('/dashboard')}>Go to Today</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────── question steps ─────────────────────────
  const zoneResults = step === 'tzlist' ? searchZones(tzq) : null;
  const zoneList = zoneResults ? zoneResults.list.slice(0, 40) : [];
  const zoneCount = zoneResults
    ? zoneResults.popular ? `Popular zones. Type to search all ${zoneResults.total}.`
      : zoneResults.total > 40 ? `Showing 40 of ${zoneResults.total}. Keep typing to narrow it down.`
      : `${zoneResults.total} ${zoneResults.total === 1 ? 'match' : 'matches'}` : '';

  const quickZones: { id: string; label: string; off: string }[] = [
    { id: 'Africa/Lagos', label: 'West Africa Time (WAT), Lagos', off: 'GMT+1' },
    { id: 'UTC', label: 'Greenwich Mean Time (GMT)', off: 'GMT+0' },
  ];

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const segs = [0, 1, 2, 3, 4, 5].map((i) => (seg === undefined ? '' : i < seg ? 'done' : i === seg ? 'cur' : ''));

  return (
    <div className="rx rx-ob with-side">
      <div className="rx-ob-main">
        <div className="rx-ob-head">
          <button type="button" className="rx-ib" aria-label="Back" onClick={back}><ArrowLeft aria-hidden /></button>
          <div className="rx-segs" role="img" aria-label={`Step ${(seg ?? 0) + 1} of 6`}>{segs.map((c, i) => <span key={i} className={`rx-seg ${c}`} />)}</div>
        </div>

        <div className="rx-ob-content">
          {OB_SAGE[step as ObStep] && (
            <p className="rx-sageline rx-rise"><SageMark size={22} /><span><span className="sgl">Sage</span><span className="tx">{OB_SAGE[step as ObStep]}</span></span></p>
          )}

          {step === 'notify' && (
            <div className="rx-stack rx-rise">
              <div className="rx-obicon"><Bell aria-hidden /></div>
              <div><h1 className="rx-title">A nudge, not noise</h1><span className="rx-rule" /></div>
              <div className="rx-stack-sm"><p className="rx-p">One or two reminders a day at most.</p><p className="rx-p">None during your quiet hours.</p><p className="rx-p">Only about the practice you chose.</p></div>
              <div className="rx-soft"><p className="rx-sm">Your device will ask for permission next. You can change it later in Settings.</p></div>
              {note && <p className="rx-sm" role="status" style={{ color: 'var(--rx-muted)' }}>{note}</p>}
            </div>
          )}

          {step === 'interests' && (
            <div className="rx-stack rx-rise">
              <div><h1 className="rx-title">What do you want to grow?</h1><span className="rx-rule" style={{ marginBottom: 4 }} /></div>
              <div className="rx-grid2">
                {INTEREST_GROUPS.map((g) => (
                  <div key={g.dim} className="rx-dimcard">
                    <div className="rx-row rx-nw" style={{ gap: 12 }}>
                      <span className="rx-dimdot">{DIM_ICON[g.dim]}</span>
                      <div style={{ minWidth: 0 }}><p className="rx-h3">{g.dim}</p><p className="rx-sm">{g.desc}</p></div>
                    </div>
                    <div className="rx-row" style={{ gap: 8 }}>
                      {g.items.map((it) => {
                        const on = interests.includes(it);
                        return (
                          <button key={it} type="button" className="rx-chip" aria-pressed={on} onClick={() => setInterests((c) => toggle(c, it))}>
                            {on && <Check aria-hidden />}{it}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'purpose' && (
            <div className="rx-stack-lg rx-rise">
              <div><h1 className="rx-title">Where are you now?</h1><span className="rx-rule" style={{ marginBottom: 0 }} /></div>
              {([['purpose', 'How clear is your sense of purpose?', 'Not clear yet', 'Very clear', purpose, setPurpose], ['effort', 'How much time can you give each week?', 'A little', 'A lot', effort, setEffort]] as const).map(([key, q, lo, hi, val, setVal]) => (
                <div key={key} className="rx-stack-sm">
                  <p className="rx-h3">{q}</p>
                  <div className="rx-steps" role="group" aria-label={q}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" className="rx-step" style={{ height: 44 + n * 10 }} aria-pressed={val === n} aria-label={`${n} of 5`} onClick={() => setVal(n)}>{n}</button>
                    ))}
                  </div>
                  <div className="rx-between rx-sm"><span>{lo}</span><span>{hi}</span></div>
                  <p className="rx-p rx-rise" style={{ minHeight: 24, fontSize: 15, color: 'var(--rx-muted)' }}>{REASSURE[key][val - 1]}</p>
                </div>
              ))}
              <div className="rx-stack-sm"><p className="rx-h3">Do you lead, teach or mentor anyone now?</p>
                <div className="rx-opts">{LEAD_OPTIONS.map((o) => <button key={o} type="button" className="rx-opt" aria-pressed={lead === o} onClick={() => setLead(o)}><User aria-hidden />{o}</button>)}</div></div>
              <div className="rx-stack-sm"><p className="rx-h3">Running a project that serves others?</p>
                <div className="rx-opts">{PROJ_OPTIONS.map((o) => <button key={o} type="button" className="rx-opt" aria-pressed={project === o} onClick={() => setProject(o)}><Clock aria-hidden />{o}</button>)}</div></div>
            </div>
          )}

          {step === 'goal' && (
            <div className="rx-stack rx-rise">
              <div className="rx-obicon"><Flag aria-hidden /></div>
              <p className="rx-label">Goal {Math.min(gi, goals.length - 1) + 1} of up to 3</p>
              <h1 className="rx-big" style={{ fontSize: 26 }}>What’s one goal for the next 90 days?</h1>
              <input className="rx-in big" value={goal.g} maxLength={240} onChange={(e) => setGoalField('g', e.target.value)} placeholder="For example: finish my study plan" aria-label="Your goal" autoFocus />
              <p className="rx-sm">Make it something you can act on every week.</p>
            </div>
          )}

          {step === 'serve' && (
            <div className="rx-stack rx-rise">
              <div className="rx-obicon"><Heart aria-hidden /></div>
              <p className="rx-label" style={{ textTransform: 'none', letterSpacing: 0 }}>{goal.g}</p>
              <h1 className="rx-big" style={{ fontSize: 26 }}>Who does this goal serve?</h1>
              <input className="rx-in big" value={goal.who} maxLength={120} onChange={(e) => setGoalField('who', e.target.value)} placeholder="For example: my family" aria-label="Who this goal serves" />
              <div className="rx-opts">{WHO_SUGGEST.map((w) => <button key={w} type="button" className="rx-opt" onClick={() => setGoalField('who', w)}>{w}</button>)}</div>
              {goals.length < 3 && (
                <div><button type="button" className="rx-link" onClick={() => { setGoals((c) => [...c, { g: '', who: '' }]); setGi(goals.length); setStep('goal'); }}>Add another goal<ArrowRight aria-hidden /></button></div>
              )}
            </div>
          )}

          {step === 'slots' && (
            <div className="rx-stack rx-rise">
              <div className="rx-obicon"><CalendarDays aria-hidden /></div>
              <h1 className="rx-big" style={{ fontSize: 26 }}>When can you usually show up?</h1>
              <p className="rx-sm">Pick any that apply.</p>
              <div className="rx-optcol">
                {SLOT_OPTIONS.map((o) => { const on = slots.includes(o); return (
                  <button key={o} type="button" className="rx-opt" aria-pressed={on} onClick={() => setSlots((c) => toggle(c, o))}>{on && <Check aria-hidden />}{o}</button>
                ); })}
              </div>
            </div>
          )}

          {step === 'timezone' && (
            <div className="rx-stack rx-rise">
              <div className="rx-obicon"><Globe aria-hidden /></div>
              <h1 className="rx-big" style={{ fontSize: 26 }}>Which time zone are you in?</h1>
              <p className="rx-sm">Times in the app show in your zone.</p>
              <button type="button" className="rx-tzrow" aria-pressed={tz.src === 'detected'} onClick={() => setTz({ id: detected.id, label: `${detected.city}, ${detected.country} (${detected.off})`, src: 'detected' })}>
                <MapPin aria-hidden style={{ width: 20, height: 20, color: 'var(--rx-muted)' }} />
                <span className="rx-tzc"><span className="rx-sm">Detected on this device</span><span>{detected.city}, {detected.country} ({detected.off})</span></span>
              </button>
              <p className="rx-label" style={{ marginTop: 4 }}>Quick picks</p>
              <div className="rx-stack-sm">
                {quickZones.map((q) => (
                  <button key={q.id} type="button" className="rx-tzrow" aria-pressed={tz.src === 'quick' && tz.id === q.id} onClick={() => setTz({ id: q.id, label: q.label, src: 'quick' })}>
                    <span className="rx-tzc"><span>{q.label}</span></span><span className="rx-sm">{q.off}</span>
                  </button>
                ))}
                {tz.src === 'list' && (
                  <button type="button" className="rx-tzrow" aria-pressed="true"><span className="rx-tzc"><span className="rx-sm">Chosen from the list</span><span>{tz.label}</span></span><Check aria-hidden style={{ width: 18, height: 18, color: 'var(--rx-gold)' }} /></button>
                )}
                <button type="button" className="rx-tzrow" onClick={() => setStep('tzlist')}>
                  <span className="rx-tzc"><span>Another time zone</span><span className="rx-sm">Search by city or country</span></span><ArrowRight aria-hidden style={{ width: 18, height: 18, color: 'var(--rx-muted)' }} />
                </button>
              </div>
            </div>
          )}

          {step === 'tzlist' && (
            <div className="rx-stack rx-rise">
              <h1 className="rx-big" style={{ fontSize: 26 }}>Find your time zone</h1>
              <label className="rx-in" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Search aria-hidden style={{ width: 20, height: 20, color: 'var(--rx-muted)' }} />
                <input style={{ border: 0, outline: 0, background: 'none', flex: 1, height: 44, fontSize: 16, fontFamily: 'inherit' }} placeholder="Search by city or country" aria-label="Search time zones" value={tzq} onChange={(e) => setTzq(e.target.value)} />
              </label>
              <p className="rx-sm">{zoneCount}</p>
              <div className="rx-stack-sm">
                {zoneList.map((z: TzInfo) => {
                  const on = tz.src === 'list' && tz.id === z.id;
                  return (
                    <button key={z.id} type="button" className="rx-tzrow" aria-pressed={on}
                      onClick={() => { setTz({ id: z.id, label: `${z.city}, ${z.country} (${z.off})`, src: 'list' }); setTzq(''); setStep('timezone'); toast(`Time zone set to ${z.city}.`); }}>
                      <span className="rx-tzc"><span>{z.city} ({z.off})</span><span className="rx-sm">{z.country}</span></span>
                      {on && <Check aria-hidden style={{ width: 18, height: 18, color: 'var(--rx-gold)' }} />}
                    </button>
                  );
                })}
              </div>
              {zoneResults && zoneResults.total === 0 && <div className="rx-empty"><p className="rx-p">No match. Try a nearby city or the country name.</p></div>}
            </div>
          )}

          {step === 'language' && (
            <div className="rx-stack rx-rise">
              <div className="rx-obicon"><Languages aria-hidden /></div>
              <h1 className="rx-big" style={{ fontSize: 26 }}>Which language do you prefer?</h1>
              <p className="rx-sm">For Sage and your Circle. You can change it later.</p>
              <div className="rx-optcol">{LANGUAGES.map((l) => <button key={l} type="button" className="rx-opt" aria-pressed={language === l} onClick={() => setLanguage(l)}>{l}</button>)}</div>
            </div>
          )}

          {step === 'survey' && (
            <div className="rx-stack rx-rise" key={sq}>
              <div className="rx-between"><p className="rx-label">Question {sq + 1} of {SURVEY_QUESTIONS.length}</p><span className="rx-sm">Private to you</span></div>
              <div className="rx-bar"><span style={{ width: `${Math.round(((sq + 1) / SURVEY_QUESTIONS.length) * 100)}%` }} /></div>
              <h1 className="rx-big" style={{ fontSize: 26 }}>{SURVEY_QUESTIONS[sq]}</h1>
              <div className="rx-optcol">
                {AGREE.map((a, i) => (
                  <button key={a} type="button" className="rx-opt" aria-pressed={answers[sq] === i + 1} onClick={() => setAnswers((cur) => cur.map((v, j) => (j === sq ? i + 1 : v)))}>{a}</button>
                ))}
              </div>
              <div><button type="button" className="rx-link" disabled={pending} onClick={() => complete(true)}>Finish later, remind me in 48 hours<ArrowRight aria-hidden /></button></div>
            </div>
          )}

          {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
        </div>

        <div className="rx-ob-foot">
          <span className="rx-sm rx-ob-foot-note">{footNote[step] ?? ''}</span>
          {step === 'notify' && <button type="button" className="rx-btn secondary" disabled={busy} onClick={skipReminders}>Not now</button>}
          <button type="button" className="rx-btn primary" disabled={!canContinue || busy} aria-busy={busy} onClick={onContinue}>
            {busy && <span className="rx-spin" aria-hidden />}{working ? 'Working…' : pending ? 'Saving…' : continueLabel}
          </button>
        </div>
      </div>

      <aside className="rx-ob-side" aria-label="Your setup">
        <svg viewBox="0 0 360 240" style={{ maxWidth: 380 }} aria-hidden>
          <path d="M0 240 Q90 150 180 170 T360 70 V240Z" fill="#F1EBDD" />
          <path d="M30 230 C90 210 110 185 150 176 S220 150 250 128 S300 96 330 72" stroke="#D6D3CB" strokeWidth="2" strokeDasharray="4 7" strokeLinecap="round" fill="none" />
          {(() => { const pts = [[30, 230], [90, 212], [150, 176], [200, 158], [250, 128], [300, 96]]; const p = pts[seg ?? 0]; return <circle cx={p[0]} cy={p[1]} r="8" fill="#0F0F0E" />; })()}
          <circle cx="330" cy="72" r="5" fill="#8A4B35" />
        </svg>
        <div className="rx-stack-sm">
          <p className="rx-label">Your setup</p>
          {OB_NEXT.map((t, i) => {
            const done = seg !== undefined && i < seg;
            const cur = i === seg;
            return (
              <p key={t} className="rx-row rx-nw rx-p" style={{ gap: 12, fontSize: 15, minHeight: 32 }}>
                <span className={`rx-pd${done ? ' done' : cur ? ' cur' : ''}`}>{done && <Check aria-hidden />}</span>{t}
              </p>
            );
          })}
        </div>
        <p className="rx-sm">Everything here stays private to you and Sage.</p>
      </aside>
    </div>
  );
}

