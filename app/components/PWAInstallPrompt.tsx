'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa_dismissed_until';
const DISMISS_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err);
      });
    }

    // Don't show if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed within the last 6 hours
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return; // Still within the 6hr suppression window
    }

    // Detect desktop vs mobile
    const desktop = window.matchMedia('(min-width: 768px)').matches;
    setIsDesktop(desktop);

    // Detect iOS (Safari)
    const ua = navigator.userAgent;
    const isiOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);

    // ── Android / Chrome / Edge / Desktop ────────────────────────────────
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // ── iOS Safari ────────────────────────────────────────────────────────
    if (isiOS) {
      setShowBanner(true);
    }

    // Track successful installation
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
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setShowBanner(false);
      localStorage.removeItem(DISMISS_KEY);
    } else {
      // User declined — re-arm for next time browser re-fires
      setDeferredPrompt(null);
      const reArm = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        window.removeEventListener('beforeinstallprompt', reArm);
      };
      window.addEventListener('beforeinstallprompt', reArm);
    }
  };

  // Dismiss for 6 hours
  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS));
    setShowBanner(false);
    setShowIOSGuide(false);
  };

  if (isInstalled || !showBanner) return null;

  // ── iOS install guide modal ───────────────────────────────────────────
  if (showIOSGuide) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(15,15,14,0.4)',
        backdropFilter: 'blur(4px)',
        padding: '0 16px',
      }}>
        <div style={{
          width: '100%', maxWidth: 440,
          marginBottom: 16,
          borderRadius: 16,
          padding: '24px 20px',
          background: '#FAFAF8',
          border: '1px solid #E8E6E1',
          animation: 'pwa-slide-up 0.35s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{
              fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
              fontSize: 20, fontWeight: 700,
              color: '#0F0F0E', margin: 0,
            }}>
              Install Ascentor
            </h3>
            <button onClick={handleDismiss} style={{
              background: 'none', border: '1px solid #E8E6E1',
              borderRadius: 6, color: '#9CA3AF',
              fontSize: 16, cursor: 'pointer',
              padding: '2px 8px', lineHeight: 1,
            }}>
              ×
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <IOSStep num={1} text={<>Tap the <strong style={{ color: '#D4CFC3' }}>Share</strong> button at the bottom of Safari</>} />
            <IOSStep num={2} text={<>Scroll and tap <strong style={{ color: '#D4CFC3' }}>"Add to Home Screen"</strong></>} />
            <IOSStep num={3} text={<>Tap <strong style={{ color: '#D4CFC3' }}>"Add"</strong> — Ascentor appears on your home screen</>} />
          </div>

          <button onClick={handleDismiss} style={{
            width: '100%', marginTop: 20,
            padding: '13px 0',
            background: '#0F0F0E', color: '#FAFAF8',
            border: 'none', borderRadius: 10,
            fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
            fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
          }}>
            Got it
          </button>
        </div>
      </div>
    );
  }

  // ── DESKTOP: Top bar ──────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <>
        <style>{`
          @keyframes pwa-slide-down {
            from { opacity: 0; transform: translateY(-100%); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 9989,
          animation: 'pwa-slide-down 0.4s cubic-bezier(0.16,1,0.3,1) both',
          background: '#FAFAF8',
          borderBottom: '1px solid #E8E6E1',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          {/* Gold accent line */}
          <div style={{
            height: 2,
            background: 'linear-gradient(90deg, transparent, #C8A96E 30%, #C8A96E 70%, transparent)',
          }} />

          <div style={{
            padding: '10px 24px',
            display: 'flex', gap: 14, alignItems: 'center',
            maxWidth: 960, margin: '0 auto',
          }}>
            {/* App icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: '#0F0F0E',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(200,169,110,0.2)',
            }}>
              <img
                src="/ascentor-color-for-dark-pages.svg"
                alt="Ascentor"
                style={{ width: 22, height: 22, objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
              <p style={{
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
                fontSize: 13, fontWeight: 700,
                color: '#0F0F0E', margin: 0,
                whiteSpace: 'nowrap',
              }}>
                Install Ascentor
              </p>
              <p style={{
                fontFamily: "var(--font-body, 'Inter', sans-serif)",
                fontSize: 10, color: '#9CA3AF',
                letterSpacing: '0.06em', margin: 0,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>
                One-click access · Works offline · No app store needed
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <button onClick={handleInstall} style={{
                padding: '7px 22px',
                background: '#0F0F0E',
                color: '#FAFAF8',
                border: 'none', borderRadius: 7,
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(200,169,110,0.15)',
              }}>
                Install now
              </button>
              <button onClick={handleDismiss} style={{
                padding: '7px 14px',
                background: 'transparent',
                border: '1px solid #E8E6E1',
                borderRadius: 7,
                fontFamily: "var(--font-body, 'Inter', sans-serif)",
                fontSize: 10, color: '#9CA3AF',
                cursor: 'pointer',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}>
                Not now
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── MOBILE: Bottom banner ─────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes pwa-slide-up {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 9989,
        animation: 'pwa-slide-up 0.4s cubic-bezier(0.16,1,0.3,1) both',
        background: '#FAFAF8',
        borderTop: '1px solid #E8E6E1',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -16px 48px rgba(0,0,0,0.08)',
      }}>
        {/* Gold accent line */}
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent, #C8A96E 30%, #C8A96E 70%, transparent)',
        }} />

        <div style={{
          padding: '14px 16px 16px',
          display: 'flex', gap: 14, alignItems: 'center',
          maxWidth: 640, margin: '0 auto',
        }}>
          {/* App icon */}
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: '#0F0F0E',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(200,169,110,0.2)',
          }}>
            <img
              src="/ascentor-color-for-dark-pages.svg"
              alt="Ascentor"
              style={{ width: 30, height: 30, objectFit: 'contain' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
              fontSize: 14, fontWeight: 700,
              color: '#0F0F0E', margin: '0 0 3px',
            }}>
              Install Ascentor
            </p>
            <p style={{
              fontFamily: "var(--font-body, 'Inter', sans-serif)",
              fontSize: 10, color: '#9CA3AF',
              letterSpacing: '0.06em', margin: 0,
              textTransform: 'uppercase',
            }}>
              One tap access · Works offline
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            <button onClick={handleInstall} style={{
              padding: '9px 20px',
              background: '#0F0F0E',
              color: '#FAFAF8',
              border: 'none', borderRadius: 8,
              fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(200,169,110,0.15)',
            }}>
              Install
            </button>
            <button onClick={handleDismiss} style={{
              padding: '3px 0',
              background: 'transparent', border: 'none',
              fontFamily: "var(--font-body, 'Inter', sans-serif)",
              fontSize: 10, color: '#9CA3AF',
              cursor: 'pointer',
              letterSpacing: '0.06em',
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
        background: 'rgba(232,160,32,0.1)',
        border: '1px solid #E8E6E1',
        fontFamily: "var(--font-body, 'Inter', sans-serif)",
        fontSize: 10, fontWeight: 500, color: '#C8A96E',
      }}>
        {num}
      </div>
      <p style={{
        fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
        fontSize: 13, color: '#9CA3AF',
        margin: 0, paddingTop: 3, lineHeight: 1.5,
      }}>
        {text}
      </p>
    </div>
  );
}
