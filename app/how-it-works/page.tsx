import type { Metadata } from 'next';
import Link from 'next/link';


// Renders SVG icon strings safely  
function SvgIcon({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

export const metadata: Metadata = {
  title: 'How It Works — Ascentor',
  description:
    "From sign-up to your first breakthrough — here's exactly how Sage, human experts, and peer circles work together for your growth.",
};

/* ── Data ────────────────────────────────────────────────── */
const STEPS = [
  {
    number: '01',
    title:  'Join & set your goal',
    desc:   'Sign up in under 2 minutes. Tell us your life stage, career goal, and biggest challenge. No lengthy forms — just the essentials Sage needs to get started.',
    detail: 'Your 90-day goal becomes the anchor for every session. Sage refers back to it constantly, keeping you accountable even when life gets in the way.',
    icon:   '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    color:  '#E8A020',
    tags:   ['2-min setup', 'Goal setting', 'Instant access'],
  },
  {
    number: '02',
    title:  'Sage learns you',
    desc:   'Unlike ChatGPT, Sage is trained on real-world business culture, career dynamics, and leadership frameworks. It uses a Socratic coaching model — asking you the right questions.',
    detail: 'Every session is saved. The AI remembers what you discussed last week, tracks your progress, and adapts its coaching style to how you respond. It gets smarter about you over time.',
    icon:   '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',
    color:  '#14B8A6',
    tags:   ['Global context', 'Remembers everything', 'Socratic model'],
  },
  {
    number: '03',
    title:  'Get matched to your circle',
    desc:   "We match you with 8–12 professionals at your exact life stage, in a similar industry, facing similar challenges. This isn't a random group chat — it's your personal board.",
    detail: 'Your circle meets weekly (async or live). You celebrate wins together, hold each other accountable, and share opportunities. Some of our members have co-founded businesses from their circles.',
    icon:   '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    color:  '#8B5CF6',
    tags:   ['Matched by stage', 'Weekly check-ins', 'Real accountability'],
  },
  {
    number: '04',
    title:  'Book a human mentor session',
    desc:   'When you need a real conversation, book a 1-on-1 session with a verified mentor who has walked the exact path you\'re on. Not a coach with a certificate — someone who has done it.',
    detail: "Our mentors are vetted senior professionals — CTOs, founders, directors, GPs. They've navigated the same systems, the same politics, and the same barriers you're facing right now.",
    icon:   '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    color:  '#E8A020',
    tags:   ['Verified mentors', 'purposeful individuals', '1-on-1 sessions'],
  },
  {
    number: '05',
    title:  'Track your progress',
    desc:   'Your dashboard shows your goal progress, session history, milestones hit, and upcoming commitments. Sage generates a weekly summary of your growth.',
    detail: "At 30, 60, and 90 days you'll receive a progress report that shows exactly how far you've come. Most members report a measurable career outcome within their first 90 days.",
    icon:   '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    color:  '#14B8A6',
    tags:   ['Weekly summaries', '90-day reports', 'Milestone tracking'],
  },
];

const PILLARS = [
  {
    emoji: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',
    title: 'Sage',
    color: '#14B8A6',
    bg:    'rgba(20,184,166,0.06)',
    border:'rgba(20,184,166,0.18)',
    points: [
      'Available 24/7 — even at 2am before a big presentation',
      'Trained on global career context, not generic defaults',
      'Remembers every session and tracks your goal progress',
      'Uses Socratic questioning — not just giving answers',
      'Sends weekly progress summaries to your dashboard',
    ],
  },
  {
    emoji: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    title: 'Human Mentors',
    color: '#E8A020',
    bg:    'rgba(245,158,11,0.06)',
    border:'rgba(245,158,11,0.22)',
    points: [
      'Verified senior professionals — not generic coaches',
      'They\'ve navigated the exact barriers you\'re facing',
      '1-on-1 booking available on Builder & Climber plans',
      'Monthly group masterclasses open to all plans',
      'Industries: tech, finance, consulting, startups, NGO & more',
    ],
  },
  {
    emoji: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    title: 'Accountability Circles',
    color: '#8B5CF6',
    bg:    'rgba(139,92,246,0.06)',
    border:'rgba(139,92,246,0.18)',
    points: [
      '8–12 members matched by stage, industry, and challenge',
      'Async + live weekly check-ins — fits any schedule',
      'Shared goal accountability between members',
      'Safe space to be honest about struggles and wins',
      'Global exposure — your circle spans continents',
    ],
  },
];

const FAQS = [
  {
    q: 'How is Sage different from ChatGPT?',
    a: "ChatGPT is a general tool. Sage is specifically calibrated for real career and business context — it understands the dynamics of professional life wherever you are, not just generic Western defaults. It also remembers your history and tracks your specific 90-day goal across every session.",
  },
  {
    q: 'How does mentor matching work?',
    a: "For peer circles, we use your life stage, industry, goal, and challenge to algorithmically match you with the most relevant peers. For 1-on-1 mentor bookings, you browse verified mentor profiles and book directly — filtered by industry, seniority, and specialty.",
  },
  {
    q: 'What does a typical week look like?',
    a: "Monday: a 10-min AI check-in on your weekly priority. Wednesday: a message thread in your circle. Friday: either a booked 1-on-1 mentor session or an async voice note to your circle. Saturday: AI generates your weekly progress summary.",
  },
  {
    q: 'What if I miss a week?',
    a: "Life happens. Sage notes the gap and picks back up without judgement. Your circle can continue without you and you can catch up asynchronously. We built the system to be resilient to real life.",
  },
  {
    q: 'How quickly will I see results?',
    a: "Most members report a measurable outcome — a promotion conversation started, a new role landed, a business decision clarified — within their first 90 days. The key is showing up to your sessions consistently.",
  },
];

const COMPARE = [
  { label: 'Cost',           ascentor: 'From $5/month',         traditional: '$150–$500/session'  },
  { label: 'Availability',   ascentor: '24/7 AI + scheduled',   traditional: 'Office hours only'  },
  { label: 'Global context',ascentor: '✓ Built-in',            traditional: '✗ Rarely'           },
  { label: 'Peer community', ascentor: '✓ Matched circles',     traditional: '✗ Isolated'         },
  { label: 'Progress tracking',ascentor:'✓ Automated reports',  traditional: '✗ Manual / none'    },
  { label: 'Accountability', ascentor: '✓ AI + peer circle',    traditional: 'Varies by coach'    },
];

/* ── Nav (identical to pricing page) ─────────────────────── */
function Nav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md"
      style={{ background: 'rgba(250,250,249,0.88)', borderBottom: '1px solid #E5E5E4' }}>
      <div className="max-w-6xl mx-auto px-5 py-3.5 flex justify-between items-center">
        <Link href="/" className="lp-nav-logo">
            <img
              src="/ascentor-color-for-light-pages.svg"
              alt="Ascentor"
              style={{ height: '32px', width: 'auto' }}
            />
            </Link>
        <div className="flex items-center gap-5">
          <Link href="/who-its-for" className="text-sm hidden md:block"
            style={{ color: '#6B7280' }}>Who It&apos;s For</Link>
          <Link href="/how-it-works" className="text-sm hidden md:block font-medium"
            style={{ color: '#E8A020' }}>How It Works</Link>
          <Link href="/pricing" className="text-sm hidden md:block"
            style={{ color: '#6B7280' }}>Pricing</Link>
          <Link href="/login" className="text-sm hidden md:block"
            style={{ color: '#6B7280' }}>Log In</Link>
          <Link href="/signup"
            className="px-5 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#E8A020', color: '#000' }}>
            Join Ascentor Trial
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
import { getPublishedPage } from '@/lib/supabase/queries/marketing';

export default async function HowItWorksPage() {
  const cms = await getPublishedPage('how-it-works');

  // CMS section keys for /admin/marketing-pages/how-it-works:
  //   hero       → {eyebrow, headline, subhead}
  //   faq        → repeating items {q, a}
  //   bottom_cta → {eyebrow, headline, body, cta_label, cta_href}
  // PILLARS, STEPS, COMPARISON table are NOT wired — they are design
  // components with booleans, colors, and emojis that require code changes.
  const hero = cms?.sections.hero?.data as Record<string, string> | undefined;
  const heroEyebrow  = hero?.eyebrow  || 'THE SYSTEM';
  const heroHeadline = hero?.headline || 'Three forces working together for your growth.';
  const heroSubhead  = hero?.subhead  || 'Ascentor combines Sage, human expertise, and peer accountability into one system designed specifically for purposeful individuals.';

  const faqItems = (cms?.sections.faq?.items || []) as Array<Record<string, string>>;
  const activeFaqs: { q: string; a: string }[] = faqItems.length > 0 ? faqItems as { q: string; a: string }[] : FAQS;

  const cta = cms?.sections.bottom_cta?.data as Record<string, string> | undefined;
  const ctaEyebrow  = cta?.eyebrow   || 'READY TO START?';
  const ctaHeadline = cta?.headline  || "Your first session is free.\nYour first breakthrough won't be far behind.";
  const ctaBody     = cta?.body      || 'Join 247+ professionals already on the waitlist.';
  const ctaLabel    = cta?.cta_label || 'Join Ascentor Trial →';
  const ctaHref     = cta?.cta_href  || '/signup';
  return (
    <div className="min-h-screen"
      style={{ background: '#FAFAF9', color: '#1A1A1A', fontFamily: "'Syne', system-ui, sans-serif" }}>
      <Nav />

      {/* ── Hero ── */}
      <section className="pt-16 pb-10 text-center px-5">
        <div className="inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-5"
          style={{ background: 'rgba(245,158,11,0.08)', color: '#B45309', border: '1px solid rgba(245,158,11,0.2)' }}>
          THE SYSTEM
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold mb-4"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08', lineHeight: 1.1 }}>
          {heroHeadline}
        </h1>
        <p className="text-base max-w-2xl mx-auto" style={{ color: '#6B7280', lineHeight: 1.75 }}>
          {heroSubhead}
        </p>
      </section>

      {/* ── Three Pillars ── */}
      <section className="py-10 px-5">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
          {PILLARS.map(p => (
            <div key={p.title} className="rounded-2xl p-6 flex flex-col"
              style={{ background: '#fff', border: '1px solid #E5E5E4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-4 flex-shrink-0"
                style={{ background: p.bg, border: `1.5px solid ${p.border}` }}>
                <span dangerouslySetInnerHTML={{ __html: p.emoji }} />
              </div>
              <h3 className="text-lg font-semibold mb-4"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
                {p.title}
              </h3>
              <div className="flex flex-col gap-2.5 flex-1">
                {p.points.map(pt => (
                  <div key={pt} className="flex items-start gap-2.5">
                    <span className="text-sm mt-0.5 flex-shrink-0" style={{ color: p.color }}>✓</span>
                    <span className="text-sm" style={{ color: '#374151', lineHeight: 1.6 }}>{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Step by Step ── */}
      <section className="py-16 px-5" style={{ background: '#fff' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold tracking-widest uppercase mb-3"
              style={{ color: '#9CA3AF' }}>YOUR JOURNEY</p>
            <h2 className="text-3xl font-semibold"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
              From sign-up to breakthrough
            </h2>
          </div>

          <div className="flex flex-col gap-6">
            {STEPS.map((s, i) => (
              <div key={s.number} className="flex gap-6 items-start">
                {/* Step indicator */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: `rgba(${s.color === '#E8A020' ? '245,158,11' : s.color === '#14B8A6' ? '20,184,166' : '139,92,246'},0.1)`, border: `1.5px solid ${s.color}30` }}>
                    <span dangerouslySetInnerHTML={{ __html: s.icon }} />
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-px flex-1 mt-2" style={{ background: '#E5E5E4', minHeight: 32 }} />
                  )}
                </div>

                {/* Content */}
                <div className="pb-6 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-bold tracking-widest"
                      style={{ color: s.color }}>{s.number}</span>
                    <h3 className="text-lg font-semibold"
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
                      {s.title}
                    </h3>
                  </div>
                  <p className="text-sm mb-3" style={{ color: '#374151', lineHeight: 1.7 }}>{s.desc}</p>
                  <p className="text-sm mb-4" style={{ color: '#6B7280', lineHeight: 1.7 }}>{s.detail}</p>
                  <div className="flex flex-wrap gap-2">
                    {s.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: `rgba(${s.color === '#E8A020' ? '245,158,11' : s.color === '#14B8A6' ? '20,184,166' : '139,92,246'},0.08)`,
                          color: s.color, border: `1px solid ${s.color}25` }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] font-bold tracking-widest uppercase mb-3"
              style={{ color: '#9CA3AF' }}>THE HONEST COMPARISON</p>
            <h2 className="text-3xl font-semibold"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
              Ascentor vs. traditional coaching
            </h2>
          </div>

          <div className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid #E5E5E4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {/* Header */}
            <div className="grid grid-cols-3 px-6 py-3"
              style={{ background: '#0C0B08' }}>
              <span className="text-xs font-bold uppercase tracking-widest"
                style={{ color: '#6B7280' }}>Feature</span>
              <span className="text-xs font-bold uppercase tracking-widest text-center"
                style={{ color: '#E8A020' }}>Ascentor</span>
              <span className="text-xs font-bold uppercase tracking-widest text-center"
                style={{ color: '#6B7280' }}>Traditional Coach</span>
            </div>
            {/* Rows */}
            {COMPARE.map((row, i) => (
              <div key={row.label}
                className="grid grid-cols-3 px-6 py-4 items-center"
                style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF9', borderTop: '1px solid #E5E5E4' }}>
                <span className="text-sm font-medium" style={{ color: '#374151' }}>{row.label}</span>
                <span className="text-sm font-semibold text-center" style={{ color: '#E8A020' }}>
                  {row.ascentor}
                </span>
                <span className="text-sm text-center" style={{ color: '#9CA3AF' }}>
                  {row.traditional}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-12 px-5" style={{ background: '#fff' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-8"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
            Frequently asked questions
          </h2>
          {activeFaqs.map(f => (
            <details key={f.q} className="group mb-3 rounded-xl overflow-hidden"
              style={{ background: '#FAFAF9', border: '1px solid #E5E5E4' }}>
              <summary className="px-5 py-4 cursor-pointer text-sm font-semibold flex justify-between items-center"
                style={{ color: '#0C0B08' }}>
                {f.q}
                <span className="text-xs group-open:rotate-180 transition-transform"
                  style={{ color: '#9CA3AF' }}>▼</span>
              </summary>
              <div className="px-5 pb-4 text-sm" style={{ color: '#6B7280', lineHeight: 1.7 }}>
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto rounded-2xl p-10 text-center" style={{ background: '#0C0B08' }}>
          <div className="inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-5"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#E8A020', border: '1px solid rgba(245,158,11,0.2)' }}>
            {ctaEyebrow}
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F3F4F6', lineHeight: 1.2 }}>
            {ctaHeadline}
          </h2>
          <p className="text-sm mb-8 max-w-lg mx-auto" style={{ color: '#9CA3AF', lineHeight: 1.75 }}>
            {ctaBody}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={ctaHref}
              className="px-8 py-3.5 rounded-xl text-sm font-semibold transition-transform hover:scale-105"
              style={{ background: '#E8A020', color: '#000' }}>
              {ctaLabel}
            </Link>
            <Link href="/who-its-for"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold"
              style={{ border: '1px solid #374151', color: '#F3F4F6' }}>
              See Who It&apos;s For
            </Link>
            <Link href="/pricing"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold"
              style={{ border: '1px solid #374151', color: '#F3F4F6' }}>
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 text-center text-xs"
        style={{ borderTop: '1px solid #E5E5E4', color: '#9CA3AF' }}>
        <p>
          © {new Date().getFullYear()} Ascentor Inc. ·{' '}
          <Link href="/who-its-for">Who It&apos;s For</Link> ·{' '}
          <Link href="/how-it-works">How It Works</Link> ·{' '}
          <Link href="/pricing">Pricing</Link> ·{' '}
          <Link href="/terms">Terms</Link> ·{' '}
          <Link href="/blog">Blog</Link>
        </p>
      </footer>
    </div>
  );
}
