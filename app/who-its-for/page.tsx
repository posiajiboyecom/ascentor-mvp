import type { Metadata } from 'next';
import Link from 'next/link';
import PublicShell from '@/components/layout/PublicShell';
import { formatMoney, priceFor } from '@/lib/billing/catalog';
import { visitorCurrency } from '@/lib/geo';

// Who it's for: the three stages (Seeking, Building, Leading). The stage is set from a member's onboarding answers and
// decides which Circle and mentorship focus fits them. It does NOT decide the plan: any member chooses any plan
// (Seeker, Builder or Pinnacle, see /pricing), and Leaders who facilitate a Circle use Ascentor free.
// Members must be 18 or older (app/terms). Prices are in the visitor's currency: naira in Nigeria, US dollars elsewhere.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Who It's For | Ascentor",
  description:
    "Ascentor is for Seekers, Builders and Leaders: from people finding their direction to leaders building something that outlasts them.",
};

/* ── Data ────────────────────────────────────────────────── */
const PERSONAS = [
  {
    stage:    'Seeking',
    focus:    'Finding your direction',
    emoji:    '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>',
    color:    '#14B8A6',
    bg:       'rgba(20,184,166,0.06)',
    border:   'rgba(20,184,166,0.18)',
    tagline:  "You're figuring out where to start.",
    who: [
      'University students and recent graduates (18+)',
      'Young professionals in their first job',
      'Anyone unsure which path to take next',
      'Anyone starting again after a change in life or work',
    ],
    problems: [
      "You don't know which career path is right for you",
      "You have no professional network, yet",
      "You don't know who to ask for honest advice",
      'Imposter syndrome is real and loud',
    ],
    outcomes: [
      'A Circle of peers that meets every week',
      'Mentorship focused on foundations: knowing yourself and your direction',
      'Learn pathways across the six dimensions of the total person',
      'Sage · AI coach, to plan your week and keep your practices',
    ],
    href:     '/signup',
  },
  {
    stage:    'Building',
    focus:    'Building a career or a business',
    emoji:    '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
    color:    '#E8A020',
    bg:       'rgba(245,158,11,0.06)',
    border:   'rgba(245,158,11,0.22)',
    tagline:  "You're in the game. Now you want to win.",
    who: [
      'Early-career professionals',
      'First-time managers stepping into leadership',
      'Entrepreneurs building their first venture',
      'Professionals switching industries or roles',
    ],
    problems: [
      "You're good at your job but stuck at the same level",
      'You got promoted but nobody taught you how to lead',
      "Your peers are advancing faster and you don't know why",
      'You have no senior people in your field to learn from',
    ],
    outcomes: [
      'Industry mentorship with a view of the global tech ecosystem',
      'Remote internships and work experience in your field',
      'Opportunities and subsidised products for business owners',
      'A Circle that holds you to the work, week after week',
    ],
    href:     '/signup',
  },
  {
    stage:    'Leading',
    focus:    'Leading others',
    emoji:    '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    color:    '#8B5CF6',
    bg:       'rgba(139,92,246,0.06)',
    border:   'rgba(139,92,246,0.18)',
    tagline:  "You've built something. Now you scale it.",
    who: [
      'Mid-career leaders & senior managers',
      'Department heads and directors',
      'Founders scaling past early traction',
      'Executives transitioning to board or advisory roles',
    ],
    problems: [
      "You're the expert in the room, but who advises you?",
      'The higher you go, the lonelier it gets',
      'Strategic decisions carry real weight and real risk',
      'Your network is strong but lacks true peers at your level',
    ],
    outcomes: [
      'Facilitate a Circle and use Ascentor free',
      'Facilitator material and support from the Ascentor team',
      'Develop the next generation as you keep growing yourself',
      'Legacy: build something that outlasts you',
    ],
    href:     '/signup',
  },
];

const EVERYWHERE = [
  { title: 'Wherever you live', desc: 'Ascentor is a global community. Members join from anywhere, online.' },
  { title: 'Circles that fit you', desc: 'Circles are matched by language and interests, and meet for a short weekly call.' },
  { title: 'Priced where you are', desc: 'Members in Nigeria pay in naira. Everyone else pays in US dollars.' },
  { title: 'Calls that work on any connection', desc: 'Circle calls and mentor sessions start audio-only, and you can turn video on.' },
];

/* ── Page ────────────────────────────────────────────────── */
import { getPublishedPage } from '@/lib/supabase/queries/marketing';
import { Check, Circle, X } from 'lucide-react';

export default async function WhoItsForPage() {
  const [cms, currency] = await Promise.all([getPublishedPage('who-its-for'), visitorCurrency()]);
  const fromPrice = formatMoney(priceFor('explorer', 'solo', 'monthly', currency), currency);

  // CMS section keys for /admin/marketing-pages/who-its-for:
  //   hero       → {eyebrow, headline, subhead}
  //   bottom_cta → {eyebrow, headline, body, cta_label, cta_href}
  // PERSONAS cards are NOT wired - they have emoji, bg, border, color,
  // popular flags that require code changes, not just content editing.
  const hero = cms?.sections.hero?.data as Record<string, string> | undefined;
  const heroEyebrow  = hero?.eyebrow  || 'Every stage of ascent';
  const heroHeadline = hero?.headline || "Wherever you are on your journey, we're built for you.";
  const heroSubhead  = hero?.subhead  || 'Ascentor is for Seekers, Builders and Leaders. From the graduate working out what to do with their life, to the leader deciding what kind of legacy to leave.';

  const cta = cms?.sections.bottom_cta?.data as Record<string, string> | undefined;
  const ctaEyebrow  = cta?.eyebrow   || 'Rise by choice';
  const ctaHeadline = cta?.headline  || "Everyone who made it\nhad someone who believed in them.";
  const ctaBody     = cta?.body      || 'Join a Circle, find your mentor and start building. Every plan starts with 7 days free.';
  const ctaLabel    = cta?.cta_label || 'See pricing';
  const ctaHref     = cta?.cta_href  || '/pricing';
  return (
    <PublicShell>
    <div
      style={{ background: '#FAFAF9', color: '#1A1A1A', fontFamily: "'Metropolis', system-ui, sans-serif" }}>
      {/* Content */}

      {/* ── Hero ── */}
      <section className="pt-16 pb-10 text-center px-5">
        <div className="inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-5"
          style={{ background: 'rgba(245,158,11,0.08)', color: '#B45309', border: '1px solid rgba(245,158,11,0.2)' }}>
          {heroEyebrow}
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold mb-4"
          style={{ fontFamily: "'Metropolis', sans-serif", color: '#0C0B08', lineHeight: 1.1 }}>
          {heroHeadline}
        </h1>
        <p className="text-base max-w-2xl mx-auto mb-8" style={{ color: '#6B7280', lineHeight: 1.75 }}>
          {heroSubhead}
        </p>
        {/* Stage nav pills */}
        <div className="flex flex-wrap justify-center gap-3">
          {PERSONAS.map(p => (
            <a key={p.stage} href={`#${p.stage.toLowerCase()}`}
              className="px-5 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
              style={{ background: p.bg, border: `1.5px solid ${p.border}`, color: p.color }}>
              <span dangerouslySetInnerHTML={{ __html: p.emoji }} /> {p.stage} · {p.focus}
            </a>
          ))}
        </div>
      </section>

      {/* ── Persona Cards ── */}
      {PERSONAS.map((p, idx) => (
        <section
          key={p.stage}
          id={p.stage.toLowerCase()}
          className="py-16 px-5"
          style={{ background: idx % 2 === 1 ? '#fff' : '#FAFAF9' }}
        >
          <div className="max-w-6xl mx-auto">

            {/* Stage header */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: p.bg, border: `1.5px solid ${p.border}` }}>
                  <span dangerouslySetInnerHTML={{ __html: p.emoji }} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-semibold"
                      style={{ fontFamily: "'Metropolis', sans-serif", color: '#0C0B08' }}>
                      {p.stage}
                    </h2>
                  </div>
                  <p className="text-sm font-medium mt-0.5" style={{ color: p.color }}>{p.focus} · {p.tagline}</p>
                </div>
              </div>
            </div>

            {/* Three columns */}
            <div className="grid md:grid-cols-3 gap-6 mb-10">

              {/* Who */}
              <div className="rounded-2xl p-6"
                style={{ background: '#fff', border: '1px solid #E5E5E4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-4"
                  style={{ color: '#9CA3AF' }}>Who This Is For</p>
                <div className="flex flex-col gap-3">
                  {p.who.map(w => (
                    <div key={w} className="flex items-start gap-3">
                      <span className="mt-1 text-xs flex-shrink-0" style={{ color: p.color }}><Circle size={8} fill="currentColor" aria-hidden="true" /></span>
                      <span className="text-sm" style={{ color: '#374151', lineHeight: 1.6 }}>{w}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Problems */}
              <div className="rounded-2xl p-6"
                style={{ background: '#fff', border: '1px solid #E5E5E4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-4"
                  style={{ color: '#9CA3AF' }}>What You&apos;re Struggling With</p>
                <div className="flex flex-col gap-3">
                  {p.problems.map(prob => (
                    <div key={prob} className="flex items-start gap-3">
                      <span className="mt-1 text-xs flex-shrink-0" style={{ color: '#EF4444' }}><X size={13} aria-hidden="true" /></span>
                      <span className="text-sm" style={{ color: '#374151', lineHeight: 1.6 }}>{prob}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outcomes */}
              <div className="rounded-2xl p-6"
                style={{ background: p.bg, border: `1.5px solid ${p.border}`, boxShadow: `0 4px 20px ${p.color}10` }}>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-4"
                  style={{ color: p.color }}>What You&apos;ll Achieve</p>
                <div className="flex flex-col gap-3">
                  {p.outcomes.map(o => (
                    <div key={o} className="flex items-start gap-3">
                      <span className="mt-0.5 text-sm flex-shrink-0" style={{ color: p.color }}><Check size={13} aria-hidden="true" /></span>
                      <span className="text-sm font-medium" style={{ color: '#0C0B08', lineHeight: 1.6 }}>{o}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA strip */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl p-6"
              style={{ background: '#0C0B08' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#F3F4F6' }}>
                  {p.stage === 'Leading'
                    ? <>Facilitate a Circle and lead <span style={{ color: p.color }}>for free</span>, or choose any plan.</>
                    : <>Plans from <span style={{ color: p.color }}>{fromPrice} a month</span>. Choose any plan.</>}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                  Seeker, Builder or Pinnacle. 7 days free, cancel any time.
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/pricing"
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ border: '1px solid #374151', color: '#D1D5DB' }}>
                  See pricing
                </Link>
                <Link href={p.href}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-transform hover:scale-105"
                  style={{ background: p.color, color: '#000' }}>
                  Join Ascentor →
                </Link>
              </div>
            </div>

          </div>
        </section>
      ))}

      {/* ── Where We Operate ── */}
      <section className="py-16 px-5" style={{ background: '#fff' }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: '#9CA3AF' }}>
            Where We Are
          </p>
          <h2 className="text-3xl font-semibold mb-3"
            style={{ fontFamily: "'Metropolis', sans-serif", color: '#0C0B08' }}>
            Built for purposeful individuals, everywhere.
          </h2>
          <p className="text-sm max-w-xl mx-auto mb-10" style={{ color: '#6B7280', lineHeight: 1.7 }}>
            One community, online, wherever you are. Your stage helps us place you in the right Circle.
            It doesn&apos;t decide your plan: every member chooses their own.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {EVERYWHERE.map(c => (
              <div key={c.title} className="rounded-2xl p-5 text-left"
                style={{ background: '#FAFAF9', border: '1px solid #E5E5E4' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#0C0B08' }}>{c.title}</p>
                <p className="text-xs" style={{ color: '#6B7280', lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto rounded-2xl p-10 text-center" style={{ background: '#0C0B08' }}>
          <div className="inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-5"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#E8A020', border: '1px solid rgba(245,158,11,0.2)', fontFamily: "Metropolis, 'Inter', sans-serif", letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {ctaEyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4"
            style={{ fontFamily: "'Metropolis', sans-serif", color: '#F3F4F6', lineHeight: 1.2 }}>
            {ctaHeadline}
          </h2>
          <p className="text-sm mb-8 max-w-lg mx-auto" style={{ color: '#9CA3AF', lineHeight: 1.75 }}>
            {ctaBody}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className="btn-rust" style={{ padding: '0.875rem 2rem' }}>
              Start 7 days free
            </Link>
            <Link href={ctaHref}
              className="px-8 py-3.5 rounded-xl text-sm font-semibold"
              style={{ border: '1px solid #374151', color: '#F3F4F6' }}>
              {ctaLabel}
            </Link>
          </div>
        </div>
      </section>

    </div>
    </PublicShell>
  );
}
