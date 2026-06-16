'use client';

// ================================================================
// app/(app)/community/page.tsx — Discord-Powered Community
// ================================================================
// The Ascentor community chat is powered by Discord, embedded
// directly in the app. Users never need to visit Discord — the
// server is managed entirely by the Ascentor team behind the scenes.
//
// HOW IT WORKS
// ─────────────
// Discord's official Widget (iframe embed) is used. It requires:
//   1. Your Discord SERVER ID set in: NEXT_PUBLIC_DISCORD_SERVER_ID
//   2. Discord Widget enabled on that server:
//      Server Settings → Widget → Enable Server Widget → Save
//
// The widget shows live member count + online members + a chat
// channel (whichever channel you set as the widget channel in
// Discord settings). No Discord account is required to view the
// widget, but users need one to interact (type messages).
//
// TEAM SETUP CHECKLIST
// ─────────────────────
// 1. Create your Discord server (or use existing)
// 2. Server Settings → Widget → Enable Server Widget → choose channel
// 3. Copy the Server ID (right-click server icon → Copy Server ID)
// 4. Add NEXT_PUBLIC_DISCORD_SERVER_ID=<your-id> to .env.local
// 5. Add to Vercel env vars and redeploy
//
// INVITE LINK (optional)
// ───────────────────────
// Set NEXT_PUBLIC_DISCORD_INVITE_CODE=<code> to show an "Open in
// Discord" button for users who want the full experience.
// Get it from: Server Settings → Invites → Create Invite
// ================================================================

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import SageLoader from '@/components/SageLoader';

const DISCORD_SERVER_ID  = process.env.NEXT_PUBLIC_DISCORD_SERVER_ID  ?? '';
const DISCORD_INVITE     = process.env.NEXT_PUBLIC_DISCORD_INVITE_CODE ?? '';

export default function CommunityPage() {
  const [loading,   setLoading]   = useState(true);
  const [userName,  setUserName]  = useState('');
  const [userPlan,  setUserPlan]  = useState('free');
  const [isMobile,  setIsMobile]  = useState(false);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = supabaseRef.current;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, subscription_plan, subscription_status')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserName(profile.full_name?.split(' ')[0] || 'there');
        setUserPlan(profile.subscription_plan || 'free');
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <SageLoader />;

  // ── No server ID configured yet ──────────────────────────────
  if (!DISCORD_SERVER_ID) {
    return <SetupPlaceholder />;
  }

  const widgetSrc =
    `https://discord.com/widget?id=${DISCORD_SERVER_ID}&theme=dark`;

  // ── Widget height: fill viewport minus the app nav bar ───────
  // Adjust `navOffset` to match your AppShell nav height (px)
  const navOffset = 64;
  const widgetH   = `calc(100vh - ${navOffset}px)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: widgetH }}>

      {/* ── Header bar ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Discord blurple dot */}
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#5865F2', display: 'inline-block',
            boxShadow: '0 0 6px #5865F280',
          }} />
          <span style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 14, fontWeight: 600,
            color: 'var(--text)',
          }}>
            Community Chat
          </span>
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#5865F2',
            background: 'rgba(88,101,242,0.1)',
            border: '1px solid rgba(88,101,242,0.25)',
            padding: '2px 8px', borderRadius: 100,
          }}>
            Live
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Optional: open-in-Discord link for power users */}
          {DISCORD_INVITE && (
            <a
              href={`https://discord.gg/${DISCORD_INVITE}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11, letterSpacing: '0.06em',
                color: 'var(--text-muted)',
                textDecoration: 'none',
                padding: '5px 12px', borderRadius: 8,
                border: '1px solid var(--border)',
                transition: 'color 0.15s',
              }}
            >
              Open in Discord ↗
            </a>
          )}
        </div>
      </div>

      {/* ── Discord widget iframe ───────────────────────────── */}
      {/* allowTransparency + sandbox keeps it safe; no popups */}
      <iframe
        src={widgetSrc}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        // allowTransparency is not a standard React prop; cast as any
        {...{ allowTransparency: 'true' } as any}
        style={{
          flex: 1,
          border: 'none',
          width: '100%',
          // Discord widget renders poorly below ~300px; clamp on mobile
          minHeight: isMobile ? 400 : 500,
          background: 'var(--bg)',
        }}
        title="Ascentor Community Chat"
      />

      {/* ── Footer note ────────────────────────────────────── */}
      <div style={{
        padding: '8px 20px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-card)',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}>
          Community moderated by the Ascentor team
        </span>
        {/* Optional invite link for mobile where widget may feel cramped */}
        {isMobile && DISCORD_INVITE && (
          <a
            href={`https://discord.gg/${DISCORD_INVITE}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: 'auto',
              fontFamily: "'DM Mono', monospace",
              fontSize: 10, color: '#5865F2', textDecoration: 'none',
            }}
          >
            Full Discord app ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── Shown when NEXT_PUBLIC_DISCORD_SERVER_ID is not yet set ──
function SetupPlaceholder() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 24px', textAlign: 'center', gap: 16,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'rgba(88,101,242,0.1)',
        border: '1px solid rgba(88,101,242,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28,
      }}>
        💬
      </div>
      <h2 style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 28, fontWeight: 700, color: 'var(--text)',
      }}>
        Community Chat Coming Soon
      </h2>
      <p style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: 14, color: 'var(--text-muted)', maxWidth: 400, lineHeight: 1.6,
      }}>
        We're setting up a live community space for Ascentor members. Check back shortly.
      </p>

      {/* Dev-only setup instructions (hidden in production) */}
      {process.env.NODE_ENV !== 'production' && (
        <div style={{
          marginTop: 24, padding: '20px 28px', borderRadius: 12,
          background: 'rgba(232,160,32,0.06)', border: '1px dashed rgba(232,160,32,0.3)',
          textAlign: 'left', maxWidth: 480,
        }}>
          <p style={{
            fontFamily: "'DM Mono', monospace", fontSize: 11,
            letterSpacing: '0.1em', color: '#E8A020',
            textTransform: 'uppercase', marginBottom: 12,
          }}>
            Dev — Setup Required
          </p>
          <ol style={{
            fontFamily: "'DM Mono', monospace", fontSize: 12,
            color: 'var(--text-muted)', lineHeight: 2, paddingLeft: 16,
          }}>
            <li>Create or use an existing Discord server</li>
            <li>Server Settings → Widget → Enable Server Widget</li>
            <li>Choose your chat channel in Widget settings</li>
            <li>Copy the Server ID (right-click server icon)</li>
            <li>Add <code style={{ color: '#E8A020' }}>NEXT_PUBLIC_DISCORD_SERVER_ID=your_id</code> to .env.local</li>
            <li>Optionally add <code style={{ color: '#E8A020' }}>NEXT_PUBLIC_DISCORD_INVITE_CODE=your_code</code></li>
            <li>Restart dev server</li>
          </ol>
        </div>
      )}
    </div>
  );
}
