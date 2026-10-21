'use client';

import { useEffect, useState } from 'react';

const SOCIALS = [
  {
    label: 'WhatsApp',
    href: 'https://wa.me/+2348168692012',
    bg: '#25D366',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.92 0 1.75.46 3.45 1.32 4.95L2 22l5.4-1.42a9.9 9.9 0 0 0 4.64 1.15h.03c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0 0 12.04 2zm5.71 13.82c-.24.68-1.37 1.24-1.91 1.32-.51.07-1 .15-3.01-.65-1.83-.75-3.36-2.19-4.46-4.04-.7-1.18-1.18-2.5-1.33-3.88-.08-.78.42-1.18.88-1.45.32-.19.68-.3 1.05-.31.08 0 .16 0 .24.01.35.03.53.04.73.31.22.31.46.9.62 1.2.08.15.1.33.03.49-.07.16-.22.28-.37.4-.11.09-.23.18-.34.28-.1.09-.21.19-.28.3-.22.32-.19.58-.06.86.34.71.77 1.36 1.29 1.93.62.68 1.36 1.2 2.18 1.54.25.1.48.06.66-.13.09-.09.18-.21.27-.32.18-.21.34-.44.52-.65.3-.35.62-.45 1-.24.37.21 1.05.55 1.37.73.32.18.52.28.6.44.08.16.04.38-.1.9z"/></svg>
    ),
  },
  {
    label: 'X / Twitter',
    href: 'https://x.com/joinascentor',
    bg: '#0F1419',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/></svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/company/joinascentor',
    bg: '#0A66C2',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com/joinascentor',
    bg: 'linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
    ),
  },
];

/**
 * Floating social rail - fixed on the left edge, bottom aligned.
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
          bottom: 1.25rem;
          z-index: 85;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 0.375rem;
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
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
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
          color: #FFFFFF;
          text-decoration: none;
          opacity: 0;
          animation: fs-item-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          transition: scale 0.2s, box-shadow 0.2s;
          scale: 1.05;
          box-shadow: 0 4px 12px rgba(15, 15, 14, 0.12);
        }
        @keyframes fs-item-in {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .fs-link:hover {
          scale: 1.1;
          box-shadow: 0 6px 16px rgba(15, 15, 14, 0.18);
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
          /* On phones the rail sat on top of page content (labels, prices). The footer carries the same links. */
          .fs-rail { display: none; }
          .fs-link { width: 36px; height: 36px; }
          .fs-link svg { width: 15px; height: 15px; }
          .fs-label {
            left: calc(100% + 0.5rem);
            font-size: 0.6875rem;
            padding: 0.3rem 0.5rem;
          }
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
          style={{ animationDelay: `${baseDelay + 250 + i * 140}ms`, background: s.bg }}
        >
          {s.icon}
          <span className="fs-label">{s.label}</span>
        </a>
      ))}
      <span className="fs-line" aria-hidden="true" />
    </nav>
  );
}
