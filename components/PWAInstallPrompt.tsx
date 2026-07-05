'use client';

// app/components/PWAInstallPrompt.tsx
// ─────────────────────────────────────────────────────────────────────────────
// PWA install prompt — dark app design system (#0F0F0E / #C8A96E).
// Shows once per 24 hours per user (localStorage key: pwa_dismissed_until).
// Three surfaces:
//   • Desktop: slim top bar (slides down)
//   • Mobile Chrome/Android: bottom banner (slides up)
//   • Mobile iOS Safari: bottom sheet with step-by-step guide
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY        = 'pwa_dismissed_until';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Design tokens (dark app palette) ─────────────────────────────────────────
const T = {
  bg:       '#0F0F0E',        // app background
  surface:  '#161614',        // card surface
  border:   'rgba(255,255,255,0.08)',
  gold:     '#C8A96E',
  goldMid:  'rgba(200,169,110,0.15)',
  goldBord: 'rgba(200,169,110,0.30)',
  text:     '#FAFAF8',
  muted:    '#9CA3AF',
  faint:    '#4B5563',
};

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner]         = useState(false);
  const [isInstalled, setIsInstalled]       = useState(false);
  const [isIOS, setIsIOS]                   = useState(false);
  const [showIOSGuide, setShowIOSGuide]     = useState(false);
  const [isDesktop, setIsDesktop]           = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('SW registration failed:', err);
      });
    }

    // Already installed as PWA — never show
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Within the 24-hour suppression window — skip
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) return;

    const desktop = window.matchMedia('(min-width: 768px)').matches;
    setIsDesktop(desktop);

    const ua    = navigator.userAgent;
    const isiOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);

    // Marks the prompt as shown NOW: whether the user dismisses it,
    // ignores it, or navigates away, it will not appear again for
    // 24 hours. (Previously only an explicit dismiss set this key,
    // so ignoring the banner meant seeing it on every page load.)
    const markShown = () =>
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS));

    // Android / Chrome / Edge / Desktop
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
      markShown();
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari (no beforeinstallprompt support)
    if (isiOS) {
      setShowBanner(true);
      markShown();
    }

    const installedHandler = () => {
      setIsInstalled(true);
      setShowBanner(false);
      localStorage.removeItem(DISMISS_KEY);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) { setShowIOSGuide(true); return; }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setShowBanner(false);
      localStorage.removeItem(DISMISS_KEY);
    } else {
      setDeferredPrompt(null);
      const reArm = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        window.removeEventListener('beforeinstallprompt', reArm);
      };
      window.addEventListener('beforeinstallprompt', reArm);
    }
  };

  // Dismiss for exactly 24 hours
  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS));
    setShowBanner(false);
    setShowIOSGuide(false);
  };

  if (isInstalled || !showBanner) return null;

  // ── iOS install guide sheet ───────────────────────────────────────────────
  if (showIOSGuide) {
    return (
      <>
        <style>{`@keyframes pwa-slide-up{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          padding: '0 12px',
        }}>
          <div style={{
            width: '100%', maxWidth: 440,
            marginBottom: 'max(16px, env(safe-area-inset-bottom))',
            borderRadius: 18,
            padding: '24px 20px',
            background: T.surface,
            border: `1px solid ${T.goldBord}`,
            animation: 'pwa-slide-up 0.35s cubic-bezier(0.16,1,0.3,1) both',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: T.bg, border: `1px solid ${T.goldBord}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ width: 20, height: 20, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <h3 style={{ fontFamily: "var(--font-display,'Plus Jakarta Sans',sans-serif)", fontSize: 17, fontWeight: 700, color: T.text, margin: 0 }}>
                  Install Ascentor
                </h3>
              </div>
              <button onClick={handleDismiss} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 18, cursor: 'pointer', padding: '1px 9px', lineHeight: 1, color: T.faint }}>×</button>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <IOSStep num={1} text={<>Tap the <strong style={{ color: T.gold }}>Share</strong> button at the bottom of Safari</>} />
              <IOSStep num={2} text={<>Scroll down and tap <strong style={{ color: T.gold }}>"Add to Home Screen"</strong></>} />
              <IOSStep num={3} text={<>Tap <strong style={{ color: T.gold }}>"Add"</strong> — Ascentor appears on your home screen</>} />
            </div>

            {/* CTA */}
            <button onClick={handleDismiss} style={{
              width: '100%', marginTop: 22,
              padding: '13px 0',
              background: T.gold, color: T.bg,
              border: 'none', borderRadius: 10,
              fontFamily: "var(--font-display,'Plus Jakarta Sans',sans-serif)",
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              Got it
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── DESKTOP: slim top bar ─────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <>
        <style>{`@keyframes pwa-slide-down{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9989,
          animation: 'pwa-slide-down 0.4s cubic-bezier(0.16,1,0.3,1) both',
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
        }}>
          {/* Gold accent line */}
          <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${T.gold} 30%, ${T.gold} 70%, transparent)` }} />

          <div style={{ padding: '9px 24px', display: 'flex', gap: 14, alignItems: 'center', maxWidth: 960, margin: '0 auto' }}>
            {/* Icon */}
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: T.bg, border: `1px solid ${T.goldBord}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ width: 20, height: 20, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
              <p style={{ fontFamily: "var(--font-display,'Plus Jakarta Sans',sans-serif)", fontSize: 13, fontWeight: 700, color: T.text, margin: 0, whiteSpace: 'nowrap' }}>
                Install Ascentor
              </p>
              <p style={{ fontFamily: "var(--font-body,'Inter',sans-serif)", fontSize: 10, color: T.muted, letterSpacing: '0.06em', margin: 0, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                One-click access · Works offline · No app store needed
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <button onClick={handleInstall} style={{
                padding: '7px 20px',
                background: T.gold, color: T.bg,
                border: 'none', borderRadius: 7,
                fontFamily: "var(--font-display,'Plus Jakarta Sans',sans-serif)",
                fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                Install now
              </button>
              <button onClick={handleDismiss} style={{
                padding: '7px 12px',
                background: 'transparent', border: `1px solid ${T.border}`,
                borderRadius: 7,
                fontFamily: "var(--font-body,'Inter',sans-serif)",
                fontSize: 10, color: T.faint, cursor: 'pointer',
                letterSpacing: '0.06em', whiteSpace: 'nowrap',
              }}>
                Not now
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── MOBILE: bottom banner ─────────────────────────────────────────────────
  return (
    <>
      <style>{`@keyframes pwa-slide-up{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9989,
        animation: 'pwa-slide-up 0.4s cubic-bezier(0.16,1,0.3,1) both',
        background: T.surface,
        borderTop: `1px solid ${T.border}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {/* Gold accent line */}
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${T.gold} 30%, ${T.gold} 70%, transparent)` }} />

        <div style={{ padding: '14px 16px 16px', display: 'flex', gap: 14, alignItems: 'center', maxWidth: 640, margin: '0 auto' }}>
          {/* Icon */}
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: T.bg, border: `1px solid ${T.goldBord}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ width: 28, height: 28, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "var(--font-display,'Plus Jakarta Sans',sans-serif)", fontSize: 14, fontWeight: 700, color: T.text, margin: '0 0 3px' }}>
              Install Ascentor
            </p>
            <p style={{ fontFamily: "var(--font-body,'Inter',sans-serif)", fontSize: 10, color: T.muted, letterSpacing: '0.06em', margin: 0, textTransform: 'uppercase' }}>
              One tap access · Works offline
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            <button onClick={handleInstall} style={{
              padding: '9px 18px',
              background: T.gold, color: T.bg,
              border: 'none', borderRadius: 8,
              fontFamily: "var(--font-display,'Plus Jakarta Sans',sans-serif)",
              fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              Install
            </button>
            <button onClick={handleDismiss} style={{
              padding: '3px 0',
              background: 'transparent', border: 'none',
              fontFamily: "var(--font-body,'Inter',sans-serif)",
              fontSize: 10, color: T.faint, cursor: 'pointer', letterSpacing: '0.06em',
            }}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function IOSStep({ num, text }: { num: number; text: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(200,169,110,0.12)',
        border: '1px solid rgba(200,169,110,0.3)',
        fontFamily: "var(--font-body,'Inter',sans-serif)",
        fontSize: 10, fontWeight: 600, color: '#C8A96E',
      }}>
        {num}
      </div>
      <p style={{
        fontFamily: "var(--font-body,'Inter',sans-serif)",
        fontSize: 13, color: '#9CA3AF',
        margin: 0, paddingTop: 3, lineHeight: 1.6,
      }}>
        {text}
      </p>
    </div>
  );
}
