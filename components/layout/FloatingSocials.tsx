'use client';

import { useEffect, useState } from 'react';

const SOCIALS = [
  {
    label: 'X / Twitter',
    href: 'https://x.com/joinascentor',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/></svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/company/joinascentor',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com/joinascentor',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
    ),
  },
];

/**
 * Floating social rail — fixed on the left edge, vertically centred.
 * Rendered by PublicHeader, so it only ever appears on public pages.
 *
 * Entrance animation is staggered per icon and timed to lift after the
 * route preloader: the first load of a session waits longer (preloader
 * holds ~1.2s), soft navigations use a shorter lead-in.
 */
export default function FloatingSocials() {
  const [mounted, setMounted] = useState(false);
  const [baseDelay, setBaseDelay] = useState(1400);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('asc-fs-seen')) setBaseDelay(500);
      sessionStorage.setItem('asc-fs-seen', '1');
    } catch {
      setBaseDelay(500);
    }
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <nav
      className="fs-rail"
      aria-label="Ascentor on social media"
      style={{ animationDelay: `${baseDelay}ms` }}
    >
      <style>{`
        .fs-rail {
          position: fixed;
          left: 1.25rem;
          top: 50%;
          transform: translateY(-50%);
          z-index: 85;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem 0.375rem;
          background: rgba(250, 250, 248, 0.88);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid #E8E6E1;
          border-radius: 999px;
          box-shadow: 0 8px 30px rgba(15, 15, 14, 0.10);
          opacity: 0;
          animation: fs-rail-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fs-rail-in {
          from { opacity: 0; transform: translate(-20px, -50%); }
          to   { opacity: 1; transform: translate(0, -50%); }
        }
        .fs-line {
          width: 14px;
          height: 1px;
          background: #C8A96E;
          opacity: 0.7;
          margin: 0.25rem 0;
        }
        .fs-link {
          position: relative;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #6B7280;
          text-decoration: none;
          opacity: 0;
          animation: fs-item-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          transition: color 0.2s, background 0.2s, scale 0.2s;
        }
        @keyframes fs-item-in {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .fs-link:hover {
          color: #C8A96E;
          background: rgba(200, 169, 110, 0.12);
          scale: 1.1;
        }
        .fs-label {
          position: absolute;
          left: calc(100% + 0.75rem);
          top: 50%;
          transform: translate(-6px, -50%);
          white-space: nowrap;
          background: #0F0F0E;
          color: #FAFAF8;
          font-family: Metropolis, 'Inter', sans-serif;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          padding: 0.4rem 0.75rem;
          border-radius: 0.5rem;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.18s, transform 0.18s;
        }
        .fs-label::before {
          content: '';
          position: absolute;
          left: -4px;
          top: 50%;
          transform: translateY(-50%) rotate(45deg);
          width: 8px;
          height: 8px;
          background: #0F0F0E;
        }
        .fs-link:hover .fs-label {
          opacity: 1;
          transform: translate(0, -50%);
        }
        @media (max-width: 640px) {
          .fs-rail {
            left: 0.6rem;
            padding: 0.375rem 0.25rem;
            gap: 0.125rem;
          }
          .fs-link { width: 34px; height: 34px; }
          .fs-link svg { width: 15px; height: 15px; }
          .fs-label { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fs-rail, .fs-link {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      <span className="fs-line" aria-hidden="true" />
      {SOCIALS.map((s, i) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          className="fs-link"
          aria-label={s.label}
          style={{ animationDelay: `${baseDelay + 250 + i * 140}ms` }}
        >
          {s.icon}
          <span className="fs-label">{s.label}</span>
        </a>
      ))}
      <span className="fs-line" aria-hidden="true" />
    </nav>
  );
}
