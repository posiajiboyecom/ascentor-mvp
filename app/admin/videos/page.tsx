'use client';

// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Dedicated admin page
//
// Drop in: app/admin/videos/page.tsx
//
// Previously the video tool was only reachable via VideoDrawer
// inside /admin/content. This page gives it its own URL so the
// admin sidebar can link to it directly, and so deep-linking
// to /admin/videos works.
//
// The drawer lives in /admin/content/VideoDrawer.tsx — we just
// mount it here with an auto-open toggle.
// ═══════════════════════════════════════════════════════════
import { useState, useCallback } from 'react';
import VideoDrawer from '../content/VideoDrawer';

const MONO: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };
const AMBER = '#A0720A';
const AMBER_BRIGHT = '#E8A020';
const DARK  = '#0C0B08';
const WARM  = '#F5F3EE';
const MUTED = '#6B6860';
const BORDER = '#E2DDD4';

export default function VideosAdminPage() {
  const [drawerOpen, setDrawerOpen] = useState(true); // open on mount
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: WARM, padding: '40px 32px' }}>
      {/* Header */}
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ ...MONO, fontSize: 10, color: AMBER, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          Admin · Video Engine
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 600, color: DARK, margin: 0, marginBottom: 8 }}>
          Kinetic text videos
        </h1>
        <p style={{ ...MONO, fontSize: 13, color: MUTED, marginTop: 0, lineHeight: 1.6, maxWidth: 640 }}>
          Write once, render on demand. Claude drafts the script, Remotion renders the MP4, Supabase stores it.
        </p>

        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            marginTop: 20,
            padding: '12px 24px',
            borderRadius: 8,
            border: 'none',
            background: DARK,
            color: '#fff',
            ...MONO,
            fontSize: 13,
            letterSpacing: '0.04em',
            cursor: 'pointer',
          }}
        >
          ▶  Create new video
        </button>
      </div>

      {/* Drawer */}
      <VideoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        showToast={showToast}
      />

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.ok ? DARK : '#7C2D2D',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 8,
            ...MONO,
            fontSize: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            zIndex: 300,
            maxWidth: '80%',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
