'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// ============================================================
// ABOUT PAGE — /about
// Ascentor Brand Book v1.0 · 2026
// Gold #E8A020  Dark #0C0B08  Cormorant Garamond / Syne / DM Mono
// ============================================================

const TEAM = [
  {
    name: 'Gregory Cudjoe',
    role: 'Founder & CEO',
    bio: 'Former strategy consultant turned builder. Gregory founded Ascentor after watching exceptional African professionals hit invisible ceilings — not for lack of talent, but for lack of the right guidance at the right moment.',
    initials: 'GC',
  },
  {
    name: 'Ama Owusu',
    role: 'Head of Product',
    bio: 'Product leader with 8 years across fintech and edtech. Ama architects how Sage learns, listens, and grows with each member on the platform.',
    initials: 'AO',
  },
  {
    name: 'Kofi Mensah',
    role: 'Lead Engineer',
    bio: 'Full-stack engineer and open source contributor. Kofi builds the infrastructure that makes Sage feel instant, private, and reliable — even on 3G.',
    initials: 'KM',
  },
  {
    name: 'Nadia Sall',
    role: 'Head of Partnerships',
    bio: 'Former investment banker who now connects Ascentor with the organisations, employers, and investors shaping Africa\'s professional landscape.',
    initials: 'NS',
  },
];

const VALUES = [
  {
    label: 'African by Design',
    body: 'We are not a Western product adapted for Africa. Every prompt, every framework, every metaphor is built from the ground up with African professional contexts in mind.',
  },
  {
    label: 'Radical Accessibility',
    body: 'World-class mentorship should not cost a fortune or require the right connections. We work relentlessly to lower every barrier — cost, language, bandwidth, confidence.',
  },
  {
    label: 'Honest Guidance',
    body: 'Sage will not flatter you. It will challenge your assumptions, push back on weak reasoning, and celebrate genuine progress. That\'s what great mentors do.',
  },
  {
    label: 'Long-term Thinking',
    body: 'Careers are marathons. We optimise for ten-year outcomes, not this week\'s feeling. Every feature is measured against whether it truly moves members forward.',
  },
];

const STATS = [
  { value: '12,000+', label: 'Members across Africa' },
  { value: '47',      label: 'Countries represented' },
  { value: '94%',     label: 'Report a career shift in 90 days' },
  { value: '3×',      label: 'More likely to hit goals with Sage' },
];

// ── Animated number counter ──────────────────────────────────────────────────
function useCountUp(target: string, duration = 1600, started = false) {
  const [display, setDisplay] = useState('0');
  useEffect(() => {
    if (!started) return;
    const num = parseFloat(target.replace(/[^0-9.]/g, ''));
    const suffix = target.replace(/[0-9.,]/g, '');
    if (isNaN(num)) { setDisplay(target); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const current = Math.round(ease * num * 10) / 10;
      setDisplay((Number.isInteger(num) ? Math.round(current) : current) + suffix);
      if (p < 1) requestAnimationFrame(tick);
      else setDisplay(target);
    };
    requestAnimationFrame(tick);
  }, [started, target, duration]);
  return display;
}

function StatCard({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const display = useCountUp(value, 1800, visible);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      padding: '32px 24px',
      background: '#141310',
      border: '1px solid #2E2A22',
      borderRadius: 16,
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 120, height: 1,
        background: 'linear-gradient(90deg, transparent, #E8A020, transparent)',
      }} />
      <p style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 48, fontWeight: 700, lineHeight: 1,
        color: '#E8A020', margin: '0 0 10px',
        letterSpacing: '-1px',
      }}>{display}</p>
      <p style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 10, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: '#4A4438', margin: 0,
      }}>{label}</p>
    </div>
  );
}

export default function AboutPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 80); }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #0C0B08; }

        .ab-root {
          min-height: 100vh;
          background: #0C0B08;
          color: #D4CFC3;
          font-family: 'Syne', sans-serif;
          overflow-x: hidden;
        }

        /* ── Nav ── */
        .ab-nav {
          position: sticky; top: 0; z-index: 50;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 48px;
          background: rgba(12,11,8,0.88);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(212,207,195,0.07);
        }
        .ab-nav-links { display: flex; gap: 32px; align-items: center; }
        .ab-nav-link {
          font-family: 'DM Mono', monospace; font-size: 11px;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #4A4438; text-decoration: none;
          transition: color 0.2s;
        }
        .ab-nav-link:hover { color: #D4CFC3; }
        .ab-nav-cta {
          padding: 9px 20px; border-radius: 8px;
          background: #E8A020; color: #0C0B08;
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700;
          text-decoration: none; letter-spacing: 0.04em;
          transition: background 0.15s;
        }
        .ab-nav-cta:hover { background: #F5C55A; }

        @media (max-width: 640px) {
          .ab-nav { padding: 16px 20px; }
          .ab-nav-links { display: none; }
        }

        /* ── Hero ── */
        .ab-hero {
          min-height: 88vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center;
          padding: 80px 24px;
          position: relative; overflow: hidden;
        }
        .ab-hero-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(232,160,32,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232,160,32,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .ab-hero-glow {
          position: absolute; top: -120px; left: 50%; transform: translateX(-50%);
          width: 700px; height: 700px; pointer-events: none;
          background: radial-gradient(circle, rgba(232,160,32,0.08) 0%, transparent 65%);
        }
        .ab-hero-inner {
          position: relative; z-index: 1;
          max-width: 780px; margin: 0 auto;
          opacity: 0; transform: translateY(24px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .ab-hero-inner.visible { opacity: 1; transform: translateY(0); }

        /* ── Section shared ── */
        .ab-section { padding: 100px 24px; }
        .ab-section-inner { max-width: 1040px; margin: 0 auto; }
        .ab-eyebrow {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: #E8A020; margin-bottom: 16px; display: block;
        }
        .ab-section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(32px, 5vw, 52px);
          font-weight: 700; line-height: 1.1;
          color: #FEF9EC; letter-spacing: -0.5px;
        }
        .ab-divider {
          width: 48px; height: 2px; background: #E8A020;
          border-radius: 2px; margin: 20px 0 28px;
        }
        .ab-body {
          font-size: 16px; color: #7A7260; line-height: 1.85;
          max-width: 580px;
        }

        /* ── Origin story ── */
        .ab-origin {
          display: grid; grid-template-columns: 1fr 1fr; gap: 80px;
          align-items: center;
        }
        @media (max-width: 768px) { .ab-origin { grid-template-columns: 1fr; gap: 40px; } }

        .ab-origin-visual {
          position: relative; aspect-ratio: 1;
          max-width: 400px; margin: 0 auto;
        }
        .ab-origin-ring {
          position: absolute; border-radius: 50%;
          border: 1px solid rgba(232,160,32,0.15);
        }
        .ab-origin-center {
          position: absolute; inset: 22%;
          border-radius: 50%;
          background: radial-gradient(circle at 38% 38%, rgba(245,197,90,0.14), rgba(232,160,32,0.04) 60%, transparent);
          border: 1.5px solid rgba(232,160,32,0.3);
          display: flex; align-items: center; justify-content: center;
          animation: ab-pulse 3s ease-in-out infinite;
        }
        @keyframes ab-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232,160,32,0); }
          50%       { box-shadow: 0 0 48px 8px rgba(232,160,32,0.1); }
        }

        /* ── Stats grid ── */
        .ab-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) { .ab-stats-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .ab-stats-grid { grid-template-columns: 1fr; } }

        /* ── Values ── */
        .ab-values-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 2px;
          border: 1px solid #2E2A22; border-radius: 16px; overflow: hidden;
          margin-top: 48px;
        }
        @media (max-width: 640px) { .ab-values-grid { grid-template-columns: 1fr; } }

        .ab-value-cell {
          padding: 36px 32px;
          background: #0C0B08;
          border-right: 1px solid #2E2A22;
          border-bottom: 1px solid #2E2A22;
          transition: background 0.2s;
        }
        .ab-value-cell:hover { background: #141310; }
        .ab-value-cell:nth-child(even) { border-right: none; }
        .ab-value-cell:nth-last-child(-n+2) { border-bottom: none; }

        .ab-value-num {
          font-family: 'Cormorant Garamond', serif; font-size: 13px;
          color: #E8A020; opacity: 0.5; margin-bottom: 14px; display: block;
          letter-spacing: 0.1em;
        }
        .ab-value-label {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px; font-weight: 700;
          color: '#FEF9EC'; margin-bottom: 12px; line-height: 1.2;
        }
        .ab-value-body {
          font-size: 13px; color: #4A4438; line-height: 1.75;
        }

        /* ── Team ── */
        .ab-team-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px; margin-top: 48px;
        }
        @media (max-width: 900px) { .ab-team-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .ab-team-grid { grid-template-columns: 1fr; } }

        .ab-team-card {
          background: #141310; border: 1px solid #2E2A22;
          border-radius: 14px; padding: 28px 24px;
          transition: border-color 0.2s, transform 0.2s;
        }
        .ab-team-card:hover { border-color: rgba(232,160,32,0.3); transform: translateY(-3px); }

        /* ── Mission strip ── */
        .ab-mission {
          background: #141310; border-top: 1px solid #2E2A22;
          border-bottom: 1px solid #2E2A22;
          padding: 100px 24px; text-align: center; position: relative;
          overflow: hidden;
        }
        .ab-mission::before {
          content: '';
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse at center, rgba(232,160,32,0.05) 0%, transparent 65%);
        }

        /* ── Marquee ── */
        .ab-marquee-wrap {
          overflow: hidden; padding: 32px 0;
          border-top: 1px solid #2E2A22;
          border-bottom: 1px solid #2E2A22;
          background: #0C0B08;
        }
        .ab-marquee-track {
          display: flex; gap: 48px; width: max-content;
          animation: ab-marquee 28s linear infinite;
        }
        @keyframes ab-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ab-marquee-item {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px; font-style: italic;
          color: #2E2A22; white-space: nowrap;
          transition: color 0.3s;
        }
        .ab-marquee-item span { color: #E8A020; }

        /* ── CTA ── */
        .ab-cta { padding: 120px 24px; text-align: center; }
        .ab-cta-btn {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 16px 36px; background: #E8A020; color: #0C0B08;
          border-radius: 12px; font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 700; text-decoration: none;
          letter-spacing: 0.04em; transition: background 0.15s, transform 0.15s;
        }
        .ab-cta-btn:hover { background: #F5C55A; transform: translateY(-2px); }

        /* ── Footer ── */
        .ab-footer {
          border-top: 1px solid #2E2A22; padding: 40px 48px;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 16px;
        }
        @media (max-width: 640px) { .ab-footer { padding: 32px 20px; flex-direction: column; text-align: center; } }
      `}</style>

      <div className="ab-root">

        {/* ── Nav ── */}
        <nav className="ab-nav">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: 28 }} />
          </Link>
          <div className="ab-nav-links">
            <Link href="/careers" className="ab-nav-link">Careers</Link>
            <Link href="/products" className="ab-nav-link">Products</Link>
            <Link href="/login" className="ab-nav-cta">Get Started</Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="ab-hero">
          <div className="ab-hero-grid" />
          <div className="ab-hero-glow" />
          <div className={`ab-hero-inner ${mounted ? 'visible' : ''}`}>
            <span className="ab-eyebrow" style={{ marginBottom: 24 }}>About Ascentor</span>

            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(44px, 8vw, 88px)',
              fontWeight: 700, lineHeight: 1.0,
              color: '#FEF9EC', letterSpacing: '-2px',
              marginBottom: 28,
            }}>
              The mentor Africa<br />
              <em style={{ color: '#E8A020', fontStyle: 'italic' }}>was never given.</em>
            </h1>

            <p style={{
              fontSize: 17, color: '#7A7260', lineHeight: 1.8,
              maxWidth: 520, margin: '0 auto 48px',
            }}>
              Ascentor exists because exceptional talent should not require exceptional luck.
              We build AI-powered mentorship shaped entirely by African professional realities.
            </p>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/login" className="ab-cta-btn" style={{ padding: '13px 28px', fontSize: 14 }}>
                Start for free →
              </Link>
              <Link href="/careers" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', border: '1px solid #2E2A22',
                borderRadius: 12, color: '#7A7260',
                fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600,
                textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s',
              }}>
                We're hiring
              </Link>
            </div>
          </div>
        </section>

        {/* ── Marquee ── */}
        <div className="ab-marquee-wrap">
          <div className="ab-marquee-track">
            {[
              'Navigate a challenge', '·', 'Prep a conversation', '·',
              'Weekly reflection', '·', 'Accountability check', '·',
              'Navigate a challenge', '·', 'Prep a conversation', '·',
              'Weekly reflection', '·', 'Accountability check', '·',
            ].map((item, i) => (
              <span key={i} className="ab-marquee-item">
                {item === '·' ? <span>·</span> : item}
              </span>
            ))}
          </div>
        </div>

        {/* ── Origin story ── */}
        <section className="ab-section">
          <div className="ab-section-inner">
            <div className="ab-origin">
              {/* Visual */}
              <div className="ab-origin-visual">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="ab-origin-ring" style={{
                    inset: `${i * 11}%`,
                    animation: `ab-pulse ${3 + i * 0.6}s ease-in-out infinite`,
                    animationDelay: `${i * 0.4}s`,
                  }} />
                ))}
                <div className="ab-origin-center">
                  <span style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 56, fontWeight: 700,
                    color: '#E8A020', lineHeight: 1, userSelect: 'none',
                  }}>S</span>
                </div>

                {/* Orbiting labels */}
                {[
                  { label: 'Clarity', angle: -30 },
                  { label: 'Direction', angle: 60 },
                  { label: 'Growth', angle: 150 },
                  { label: 'Courage', angle: 240 },
                ].map(({ label, angle }) => {
                  const r = 42;
                  const rad = (angle * Math.PI) / 180;
                  const x = 50 + r * Math.cos(rad);
                  const y = 50 + r * Math.sin(rad);
                  return (
                    <div key={label} style={{
                      position: 'absolute',
                      left: `${x}%`, top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 9, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: '#4A4438',
                      padding: '4px 10px',
                      background: '#141310',
                      border: '1px solid #2E2A22',
                      borderRadius: 100,
                      whiteSpace: 'nowrap',
                    }}>
                      {label}
                    </div>
                  );
                })}
              </div>

              {/* Text */}
              <div>
                <span className="ab-eyebrow">Our Origin</span>
                <h2 className="ab-section-title">
                  Built from<br />lived experience.
                </h2>
                <div className="ab-divider" />
                <p className="ab-body" style={{ marginBottom: 24 }}>
                  Our founder spent years watching talented colleagues across Ghana, Nigeria, Kenya,
                  and Senegal stall — not because they lacked ability, but because they lacked access
                  to the candid, informed guidance that their peers in London or New York took for granted.
                </p>
                <p className="ab-body" style={{ marginBottom: 24 }}>
                  Ascentor began as a question: what if every professional in Africa had a world-class
                  mentor in their pocket — one that understood their context, spoke their language, and
                  never ran out of time?
                </p>
                <p className="ab-body">
                  Sage, our AI mentor, is the answer we built. It is trained not on generic career advice,
                  but on the specific dynamics of African professional life: how power works, how
                  industries move, what ambition looks like here.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section style={{ padding: '0 24px 100px' }}>
          <div style={{ maxWidth: 1040, margin: '0 auto' }}>
            <div className="ab-stats-grid">
              {STATS.map(s => <StatCard key={s.label} {...s} />)}
            </div>
          </div>
        </section>

        {/* ── Mission strip ── */}
        <div className="ab-mission">
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>
            <span className="ab-eyebrow" style={{ display: 'block', marginBottom: 24 }}>Our Mission</span>
            <blockquote style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(28px, 5vw, 52px)',
              fontWeight: 700, fontStyle: 'italic',
              lineHeight: 1.25, color: '#FEF9EC',
              letterSpacing: '-0.5px', margin: 0,
            }}>
              "To make elite mentorship as accessible as a mobile connection — for every professional on the African continent."
            </blockquote>
            <div style={{
              marginTop: 32, display: 'inline-flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(232,160,32,0.1)',
                border: '1.5px solid rgba(232,160,32,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 16, fontWeight: 700, color: '#E8A020',
                }}>GC</span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600, color: '#D4CFC3', margin: 0 }}>'Posi Ajiboye</p>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A4438', margin: 0 }}>Founder & CEO</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Values ── */}
        <section className="ab-section">
          <div className="ab-section-inner">
            <div style={{ maxWidth: 560 }}>
              <span className="ab-eyebrow">What We Believe</span>
              <h2 className="ab-section-title">Principles we<br />build everything on.</h2>
              <div className="ab-divider" />
            </div>
            <div className="ab-values-grid">
              {VALUES.map((v, i) => (
                <div key={v.label} className="ab-value-cell">
                  <span className="ab-value-num">0{i + 1}</span>
                  <h3 style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 22, fontWeight: 700,
                    color: '#FEF9EC', marginBottom: 12, lineHeight: 1.2,
                  }}>
                    {v.label}
                  </h3>
                  <p className="ab-value-body">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Team ── */}
        <section className="ab-section" style={{ paddingTop: 0 }}>
          <div className="ab-section-inner">
            <div style={{ maxWidth: 560 }}>
              <span className="ab-eyebrow">The Team</span>
              <h2 className="ab-section-title">Built by people<br />who've lived it.</h2>
              <div className="ab-divider" />
              <p className="ab-body" style={{ marginBottom: 48 }}>
                We are a small, distributed team — across Accra, Lagos, Nairobi, and Dakar.
                Every person here chose this over something safer.
              </p>
            </div>
            <div className="ab-team-grid">
              {TEAM.map(member => (
                <div key={member.name} className="ab-team-card">
                  {/* Avatar */}
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'radial-gradient(circle at 38% 36%, rgba(245,197,90,0.2), rgba(232,160,32,0.06) 60%, transparent)',
                    border: '1.5px solid rgba(232,160,32,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 18,
                  }}>
                    <span style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: 18, fontWeight: 700, color: '#E8A020',
                    }}>{member.initials}</span>
                  </div>
                  <p style={{
                    fontFamily: "'Syne', sans-serif", fontSize: 15,
                    fontWeight: 700, color: '#FEF9EC', marginBottom: 4,
                  }}>{member.name}</p>
                  <p style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 9,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: '#E8A020', marginBottom: 14,
                  }}>{member.role}</p>
                  <p style={{
                    fontSize: 12, color: '#4A4438', lineHeight: 1.7,
                  }}>{member.bio}</p>
                </div>
              ))}
            </div>

            {/* Hiring nudge */}
            <div style={{
              marginTop: 20, padding: '20px 24px',
              background: 'rgba(232,160,32,0.04)',
              border: '1px dashed rgba(232,160,32,0.2)',
              borderRadius: 12, display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
              gap: 16, flexWrap: 'wrap',
            }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, color: '#7A7260', margin: 0 }}>
                We're growing. Come build with us.
              </p>
              <Link href="/careers" style={{
                fontFamily: "'DM Mono', monospace", fontSize: 10,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#E8A020', textDecoration: 'none',
                padding: '8px 16px', border: '1px solid rgba(232,160,32,0.3)',
                borderRadius: 8, transition: 'background 0.15s',
              }}>
                View open roles →
              </Link>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="ab-cta">
          <span className="ab-eyebrow" style={{ display: 'block', marginBottom: 20 }}>Get Started</span>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 700, color: '#FEF9EC',
            letterSpacing: '-1px', lineHeight: 1.1,
            marginBottom: 20,
          }}>
            Your mentor is waiting.
          </h2>
          <p style={{
            fontSize: 16, color: '#7A7260', lineHeight: 1.7,
            maxWidth: 420, margin: '0 auto 40px',
          }}>
            Join 12,000 professionals across Africa who are navigating their careers with clarity.
          </p>
          <Link href="/login" className="ab-cta-btn">
            Start free today →
          </Link>
        </section>

        {/* ── Footer ── */}
        <footer className="ab-footer">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: 22 }} />
          </Link>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { label: 'Careers', href: '/careers' },
              { label: 'Privacy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
              { label: 'Contact', href: 'mailto:hello@ascentor.co' },
            ].map(l => (
              <Link key={l.label} href={l.href} style={{
                fontFamily: "'DM Mono', monospace", fontSize: 10,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#4A4438', textDecoration: 'none', transition: 'color 0.2s',
              }}>
                {l.label}
              </Link>
            ))}
          </div>
          <p style={{
            fontFamily: "'DM Mono', monospace", fontSize: 9,
            letterSpacing: '0.08em', color: '#2E2A22',
          }}>
            © 2026 ASCENTOR
          </p>
        </footer>

      </div>
    </>
  );
}
