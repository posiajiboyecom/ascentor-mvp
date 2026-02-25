import type { Metadata } from 'next';
import Link from 'next/link';
import WaitlistClient from './WaitlistClient';

export const metadata: Metadata = {
  title: 'Join the Waitlist — Ascentor',
  description:
    "Africa's mentorship platform is almost here. Secure early access and get 3 months free on launch.",
};

/* ─────────────────────────────────────────────────────────────
   Proof points rendered on the left panel (server-side)
───────────────────────────────────────────────────────────── */
const PROOF_POINTS = [
  {
    emoji: '🤖',
    title: '24/7 AI Mentor',
    desc: 'Personalized guidance trained on African career context — available at 2am before your biggest moment.',
  },
  {
    emoji: '🎓',
    title: "Human Mentors Who've Been There",
    desc: "Live sessions with Africa's top professionals. Real experience. Not theory.",
  },
  {
    emoji: '👥',
    title: 'Your Mentorship Circle',
    desc: 'Matched with peers at your exact life stage. Your personal board of advisors.',
  },
];

const AVATARS = [
  { initial: 'T', bg: 'linear-gradient(135deg,#E8A020,#C87020)' },
  { initial: 'A', bg: 'linear-gradient(135deg,#C87020,#A05010)' },
  { initial: 'K', bg: 'linear-gradient(135deg,#F5C55A,#E8A020)' },
  { initial: 'F', bg: 'linear-gradient(135deg,#A05010,#804000)' },
  { initial: '+', bg: 'linear-gradient(135deg,#E8A020,#804000)' },
];

/* ─────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────── */
export default function WaitlistPage() {
  return (
    <>
      {/* Google Fonts — Cormorant Garamond + Syne, matching HTML file */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Syne:wght@400;500;600;700;800&display=swap');

        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        html { scroll-behavior:smooth; }

        body {
          font-family: 'Syne', sans-serif;
          background: #0C0B08;
          color: #F5F0E8;
          overflow-x: hidden;
        }

        /* Grain overlay */
        .grain {
          position: fixed; inset: 0; z-index: 1;
          opacity: 0.032; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        /* Live dot pulse */
        @keyframes livePulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.35; transform:scale(0.65); }
        }
        .live-dot { animation: livePulse 2s ease infinite; }

        /* Gold top-border accent on counter card */
        .counter-block::before {
          content:''; position:absolute;
          left:0; top:0; bottom:0; width:3px;
          background: linear-gradient(180deg,#E8A020,transparent);
        }

        /* Right panel radial glows */
        .right-glow-top::before {
          content:''; position:absolute;
          width:500px; height:500px; border-radius:50%;
          background: radial-gradient(circle, rgba(232,160,32,0.06) 0%, transparent 70%);
          top:-100px; right:-100px; pointer-events:none;
        }
        .right-glow-bottom::after {
          content:''; position:absolute;
          width:300px; height:300px; border-radius:50%;
          background: radial-gradient(circle, rgba(232,160,32,0.04) 0%, transparent 70%);
          bottom:-50px; left:-50px; pointer-events:none;
        }

        /* Position card top gradient line */
        .position-card-line::before {
          content:''; position:absolute;
          top:0; left:0; right:0; height:2px;
          background: linear-gradient(90deg,#E8A020,#F5C55A,transparent);
        }

        /* Mobile */
        @media (max-width: 860px) {
          .split-layout { grid-template-columns: 1fr !important; }
          .left-panel    { min-height: auto !important; border-right: none !important; border-bottom: 1px solid rgba(245,240,232,0.07) !important; padding: 36px 24px 40px !important; }
          .right-panel   { padding: 40px 24px 60px !important; }
          .left-content  { padding: 32px 0 !important; }
        }
      `}</style>

      {/* Grain texture */}
      <div className="grain" aria-hidden="true" />

      {/* Animated particle canvas — rendered client side */}
      <WaitlistClient
        proofPoints={PROOF_POINTS}
        avatars={AVATARS}
      />
    </>
  );
}
