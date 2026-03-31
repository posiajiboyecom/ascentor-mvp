import type { Metadata } from 'next';
import Link from 'next/link';


// Renders SVG icon strings safely  
function SvgIcon({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

export const metadata: Metadata = {
  title: "Who It's For — Ascentor",
  description:
    "Ascentor is built for every stage of the ambitious professional journey — from students figuring out their path to executives scaling their impact.",
};

/* ── Data ────────────────────────────────────────────────── */
const PERSONAS = [
  {
    stage:    'Explorers',
    age:      '15 – 22',
    emoji:    '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>',
    color:    '#14B8A6',
    bg:       'rgba(20,184,166,0.06)',
    border:   'rgba(20,184,166,0.18)',
    tagline:  "You're figuring out where to start.",
    who: [
      'Final-year secondary school students',
      'University undergraduates & recent graduates',
      'Young professionals in their first job',
      'Anyone unsure which career path to take',
    ],
    problems: [
      "You don't know which career path is right for you",
      "You have no professional network — yet",
      "You can't afford a career counsellor",
      'Imposter syndrome is real and loud',
    ],
    outcomes: [
      'Clarity on your career direction within 30 days',
      'A step-by-step roadmap from student to first job',
      'Access to global opportunities & scholarships',
      'Peer circles of driven young professionals like you',
    ],
    priceNgn: 12000,
    priceUsd: 19,
    plan:     'Explorers Plan',
    href:     '/signup',
  },
  {
    stage:    'Builders',
    age:      '22 – 32',
    emoji:    '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
    color:    '#E8A020',
    bg:       'rgba(245,158,11,0.06)',
    border:   'rgba(245,158,11,0.22)',
    tagline:  "You're in the game. Now you want to win.",
    who: [
      'Early-career professionals (0–7 years experience)',
      'First-time managers stepping into leadership',
      'Entrepreneurs building their first venture',
      'Professionals switching industries or roles',
    ],
    problems: [
      "You're good at your job but stuck at the same level",
      'You got promoted but nobody taught you how to lead',
      "Your peers are advancing faster and you don't know why",
      'You lack access to senior mentors who look like you',
    ],
    outcomes: [
      'Get promoted or land your next role faster',
      'Build real leadership skills — not just theory',
      "1-on-1 sessions with mentors who've done it",
      'A personal board of advisors in your peer circle',
    ],
    priceNgn: 25000,
    priceUsd: 39,
    plan:     'Builders Plan',
    href:     '/signup',
    popular:  true,
  },
  {
    stage:    'Climbers',
    age:      '32 – 50',
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
      "You're the expert in the room — but who advises you?",
      'The higher you go, the lonelier it gets',
      'Strategic decisions carry real weight and real risk',
      'Your network is strong but lacks true peers at your level',
    ],
    outcomes: [
      'An executive peer cohort of equals who challenge you',
      'AI-powered strategic thinking partner — 24/7',
      'Unlimited access to world-class senior mentors',
      'Legacy planning: building something that outlasts you',
    ],
    priceNgn: 60000,
    priceUsd: 99,
    plan:     'Climbers Plan',
    href:     '/signup',
  },
];

const ACROSS_AFRICA = [
  { flag: '🌍', country: 'Africa',        desc: 'A strong and growing community across the continent' },
  { flag: '🇬🇭', country: 'Ghana',        desc: 'Growing fast in Accra\'s startup and finance scene' },
  { flag: '🇰🇪', country: 'Kenya',        desc: 'Nairobi\'s tech ecosystem and beyond' },
  { flag: '🇬🇧', country: 'United Kingdom', desc: 'London, Manchester, and the broader diaspora' },
  { flag: '🌐', country: 'Diaspora',      desc: 'UK, US, Canada — professionals building global careers' },
  { flag: '🌍', country: '15+ Countries', desc: 'And growing across the entire continent' },
];

/* ── Nav (identical to pricing page) ───────────────────── */
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
          <Link href="/who-its-for" className="text-sm hidden md:block font-medium"
            style={{ color: '#E8A020' }}>Who It&apos;s For</Link>
          <Link href="/how-it-works" className="text-sm hidden md:block"
            style={{ color: '#6B7280' }}>How It Works</Link>
          <Link href="/pricing" className="text-sm hidden md:block"
            style={{ color: '#6B7280' }}>Pricing</Link>
          <Link href="/login" className="text-sm hidden md:block"
            style={{ color: '#6B7280' }}>Log In</Link>
          <Link href="/signup"
            className="px-5 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#E8A020', color: '#000' }}>
            Start Free Trial
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function WhoItsForPage() {
  return (
    <div className="min-h-screen"
      style={{ background: '#FAFAF9', color: '#1A1A1A', fontFamily: "'Syne', system-ui, sans-serif" }}>
      <Nav />

      {/* ── Hero ── */}
      <section className="pt-16 pb-10 text-center px-5">
        <div className="inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-5"
          style={{ background: 'rgba(245,158,11,0.08)', color: '#B45309', border: '1px solid rgba(245,158,11,0.2)' }}>
          BUILT FOR AFRICA
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold mb-4"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08', lineHeight: 1.1 }}>
          Wherever you are on<br className="hidden md:block" /> your journey — we&apos;re built for you.
        </h1>
        <p className="text-base max-w-2xl mx-auto mb-8" style={{ color: '#6B7280', lineHeight: 1.75 }}>
          Ascentor serves every stage of the ambitious professional journey.
          From the student figuring out what to do with their life, to the executive
          deciding what kind of legacy to leave.
        </p>
        {/* Stage nav pills */}
        <div className="flex flex-wrap justify-center gap-3">
          {PERSONAS.map(p => (
            <a key={p.stage} href={`#${p.stage.toLowerCase()}`}
              className="px-5 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
              style={{ background: p.bg, border: `1.5px solid ${p.border}`, color: p.color }}>
              <span dangerouslySetInnerHTML={{ __html: p.emoji }} /> {p.stage} · {p.age}
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
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
                      {p.stage}
                    </h2>
                    {p.popular && (
                      <span className="px-3 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: p.color, color: '#000' }}>
                        Most Popular
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium mt-0.5" style={{ color: p.color }}>{p.age} · {p.tagline}</p>
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
                      <span className="mt-1 text-xs flex-shrink-0" style={{ color: p.color }}>●</span>
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
                      <span className="mt-1 text-xs flex-shrink-0" style={{ color: '#EF4444' }}>✕</span>
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
                      <span className="mt-0.5 text-sm flex-shrink-0" style={{ color: p.color }}>✓</span>
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
                  {p.plan} — starts at <span style={{ color: p.color }}>₦{p.priceNgn.toLocaleString('en-NG')}/month</span>
                  <span className="text-xs font-normal ml-2" style={{ color: '#6B7280' }}>(~${p.priceUsd} USD)</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  7-day free trial · No credit card required · Cancel anytime
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/how-it-works"
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ border: '1px solid #374151', color: '#D1D5DB' }}>
                  See How It Works
                </Link>
                <Link href={p.href}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-transform hover:scale-105"
                  style={{ background: p.color, color: '#000' }}>
                  Start Free Trial →
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
            Where We Operate
          </p>
          <h2 className="text-3xl font-semibold mb-3"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
            Built for ambitious professionals, everywhere.
          </h2>
          <p className="text-sm max-w-xl mx-auto mb-10" style={{ color: '#6B7280', lineHeight: 1.7 }}>
            Our mentors, peer circles, and AI context are specifically calibrated
            for real professional experience — not a generic tool adapted here.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ACROSS_AFRICA.map(c => (
              <div key={c.country} className="rounded-2xl p-5 text-left"
                style={{ background: '#FAFAF9', border: '1px solid #E5E5E4' }}>
                <div className="text-2xl mb-2">{c.flag}</div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#0C0B08' }}>{c.country}</p>
                <p className="text-xs" style={{ color: '#6B7280', lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto rounded-2xl p-10 text-center"
          style={{ background: '#0C0B08' }}>
          <div className="inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-5"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#E8A020', border: '1px solid rgba(245,158,11,0.2)' }}>
            YOUR MENTOR IS WAITING
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F3F4F6', lineHeight: 1.2 }}>
            Everyone who made it<br />had someone who believed in them.
          </h2>
          <p className="text-sm mb-8 max-w-lg mx-auto" style={{ color: '#9CA3AF', lineHeight: 1.75 }}>
            Join 247+ ambitious professionals already on the platform.
            Early members get <strong style={{ color: '#E8A020' }}>3 months free</strong> on launch.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/how-it-works"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold"
              style={{ border: '1px solid #374151', color: '#F3F4F6' }}>
              See How It Works
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
