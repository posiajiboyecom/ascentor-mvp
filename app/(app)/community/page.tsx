'use client';

// app/(app)/community/page.tsx
// ── Community page — Discord invite model ──────────────────────
// The iframe widget is unreliable (blocked by browsers, blank on
// mobile). Instead: a clean landing page that communicates the
// community value and sends users to Discord with one click.
// Users who signed up with Discord are already linked — they just
// tap Join and land in the right server.
// ──────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const INVITE_CODE   = process.env.NEXT_PUBLIC_DISCORD_INVITE_CODE  ?? '';
const SERVER_ID     = process.env.NEXT_PUBLIC_DISCORD_SERVER_ID     ?? '';
const INVITE_URL    = INVITE_CODE ? `https://discord.gg/${INVITE_CODE}` : '#';

// Brand tokens — matching Ascentor brand book
const B = {
  gold:       '#E8A020',
  goldMuted:  'rgba(232,160,32,0.08)',
  goldBorder: 'rgba(232,160,32,0.18)',
  discord:    '#5865F2',
  discordMuted: 'rgba(88,101,242,0.08)',
  discordBorder: 'rgba(88,101,242,0.20)',
  text:       'var(--text)',
  textMuted:  'var(--text-muted)',
  textDim:    'var(--text-dim)',
  bg:         'var(--bg)',
  bgCard:     'var(--bg-card)',
  bgInput:    'var(--bg-input)',
  border:     'var(--border)',
  fontDisplay:"'Cormorant Garamond', Georgia, serif",
  fontUI:     "'Syne', system-ui, sans-serif",
  fontMono:   "'DM Mono', 'Courier New', monospace",
};

const CHANNELS = [
  { emoji: '👋', name: '# introductions',   desc: 'Tell the community who you are and what you\'re building toward' },
  { emoji: '💼', name: '# career-wins',      desc: 'Share your offers, promotions, and milestones — big or small' },
  { emoji: '🤝', name: '# accountability',   desc: 'Weekly check-ins, goal-setting, and keeping each other honest' },
  { emoji: '🧠', name: '# industry-talk',    desc: 'Deep dives on tech, finance, consulting, and emerging sectors' },
  { emoji: '📄', name: '# cv-review',        desc: 'Drop your CV for honest, constructive peer feedback' },
  { emoji: '🎯', name: '# opportunities',    desc: 'Job openings, contract gigs, and referrals from the network' },
];

export default function CommunityPage() {
  const [userName, setUserName]  = useState('');
  const [hasDiscord, setHasDiscord] = useState(false);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    (async () => {
      const supabase = supabaseRef.current;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profile?.full_name) setUserName(profile.full_name.split(' ')[0]);

      // Check if user authenticated via Discord
      const provider = user.app_metadata?.provider;
      const identities = user.identities ?? [];
      const linkedDiscord = identities.some((i: any) => i.provider === 'discord');
      setHasDiscord(provider === 'discord' || linkedDiscord);
    })();
  }, []);

  return (
    <div style={{
      minHeight: '100%',
      background: B.bg,
      fontFamily: B.fontUI,
    }}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 680,
        margin: '0 auto',
        padding: '52px 24px 0',
        textAlign: 'center',
      }}>
        {/* Discord logo mark */}
        <div style={{
          width: 56, height: 56,
          borderRadius: 16,
          background: B.discordMuted,
          border: `1px solid ${B.discordBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill={B.discord}>
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
        </div>

        <h1 style={{
          fontFamily: B.fontDisplay,
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: 'clamp(32px, 5vw, 48px)',
          color: B.text,
          margin: '0 0 16px',
          lineHeight: 1.15,
        }}>
          {userName ? `${userName}, meet your people.` : 'Meet your people.'}
        </h1>

        <p style={{
          fontSize: 15,
          color: B.textMuted,
          lineHeight: 1.7,
          margin: '0 0 32px',
          maxWidth: 480,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          The Ascentor community lives on Discord — where real conversations happen,
          opportunities get shared, and careers are built in public.
        </p>

        {/* CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <a
            href={INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 32px',
              borderRadius: 12,
              background: B.discord,
              color: '#fff',
              fontFamily: B.fontUI,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
              letterSpacing: '0.01em',
              transition: 'opacity 0.15s',
              boxShadow: '0 4px 24px rgba(88,101,242,0.25)',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Join the Community
          </a>

          {hasDiscord && (
            <span style={{
              fontFamily: B.fontMono,
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              color: '#5865F2',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5865F2', display: 'inline-block' }} />
              Your account is linked to Discord
            </span>
          )}
        </div>
      </div>

      {/* ── Channels preview ─────────────────────────────────── */}
      <div style={{
        maxWidth: 680,
        margin: '52px auto 0',
        padding: '0 24px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        }}>
          <div style={{ flex: 1, height: 1, background: B.border }} />
          <span style={{
            fontFamily: B.fontMono,
            fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: B.textDim,
          }}>
            What's inside
          </span>
          <div style={{ flex: 1, height: 1, background: B.border }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CHANNELS.map((ch) => (
            <div
              key={ch.name}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px 16px',
                borderRadius: 10,
                background: B.bgCard,
                border: `1px solid ${B.border}`,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{ch.emoji}</span>
              <div>
                <div style={{
                  fontFamily: B.fontMono,
                  fontSize: 12, fontWeight: 500,
                  color: B.text,
                  marginBottom: 3,
                }}>
                  {ch.name}
                </div>
                <div style={{
                  fontSize: 13,
                  color: B.textMuted,
                  lineHeight: 1.5,
                }}>
                  {ch.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom CTA strip ─────────────────────────────────── */}
      <div style={{
        maxWidth: 680,
        margin: '40px auto 60px',
        padding: '24px',
        borderRadius: 16,
        background: B.goldMuted,
        border: `1px solid ${B.goldBorder}`,
        textAlign: 'center',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        <p style={{
          fontFamily: B.fontDisplay,
          fontStyle: 'italic',
          fontWeight: 600,
          fontSize: 20,
          color: B.text,
          margin: '0 0 16px',
          lineHeight: 1.4,
        }}>
          The people who make it rarely do it alone.
        </p>
        <a
          href={INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 24px',
            borderRadius: 10,
            background: 'transparent',
            border: `1px solid ${B.gold}`,
            color: B.gold,
            fontFamily: B.fontUI,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            letterSpacing: '0.02em',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = B.goldMuted)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          Join on Discord →
        </a>
      </div>

      {/* ── Not configured (dev only) ─────────────────────────── */}
      {!INVITE_CODE && process.env.NODE_ENV !== 'production' && (
        <div style={{
          maxWidth: 480, margin: '0 auto 40px', padding: '16px 20px',
          borderRadius: 10, background: 'rgba(239,68,68,0.06)',
          border: '1px dashed rgba(239,68,68,0.3)', textAlign: 'center',
        }}>
          <p style={{ fontFamily: B.fontMono, fontSize: 11, color: '#EF4444', margin: 0 }}>
            Dev: set NEXT_PUBLIC_DISCORD_INVITE_CODE in .env.local
          </p>
        </div>
      )}
    </div>
  );
}
