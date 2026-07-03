'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err);
      });
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);

    // Check if we've already dismissed
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 24 * 60 * 60 * 1000) return;
    }

    // Android/Chrome: listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: show manual guide after 3 visits
    if (isiOS) {
      const visits = parseInt(localStorage.getItem('pwa-visits') || '0') + 1;
      localStorage.setItem('pwa-visits', String(visits));
      if (visits >= 3) {
        setShowBanner(true);
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        setShowIOSGuide(true);
        return;
      }
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem('pwa-banner-dismissed', String(Date.now()));
  };

  if (isInstalled || !showBanner) return null;

  // iOS install guide modal
  if (showIOSGuide) {
    return (
      <>
        <style>{`
          @keyframes ios-sheet-up {
            from { opacity: 0; transform: translateY(100%); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes ios-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>

        {/* Backdrop */}
        <div onClick={handleDismiss} style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'ios-fade-in 0.2s ease both',
        }} />

        {/* Bottom sheet */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: 9999,
          background: '#0C0B08',
          borderTop: '1px solid rgba(232,160,32,0.2)',
          borderRadius: '20px 20px 0 0',
          animation: 'ios-sheet-up 0.4s cubic-bezier(0.16,1,0.3,1) both',
          paddingBottom: 'env(safe-area-inset-bottom)',
          overflow: 'hidden',
        }}>
          {/* Gold top bar */}
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, transparent, #E8A020 25%, #F5C55A 50%, #E8A020 75%, transparent)',
          }} />

          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
          </div>

          <div style={{ padding: '8px 24px 28px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* App icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'linear-gradient(135deg, #E8A020, #C47D0E)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(232,160,32,0.4)',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
                    fontSize: 22, fontWeight: 700, color: '#0C0B08', lineHeight: 1,
                  }}>A</span>
                </div>
                <div>
                  <p style={{
                    fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
                    fontSize: 16, fontWeight: 700, color: '#FAFAF8', margin: 0,
                  }}>Add to Home Screen</p>
                  <p style={{
                    fontFamily: "var(--font-body, 'Inter', sans-serif)",
                    fontSize: 10, color: '#6B7280',
                    letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0,
                  }}>ascentor-mvp.vercel.app</p>
                </div>
              </div>
              <button onClick={handleDismiss} style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.07)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6B7280', fontSize: 14, fontWeight: 600,
              }}>✕</button>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 24 }}>
              {[
                {
                  num: 1,
                  icon: '↑',
                  label: 'Tap Share',
                  detail: 'The share icon at the bottom of Safari',
                },
                {
                  num: 2,
                  icon: '+',
                  label: 'Add to Home Screen',
                  detail: 'Scroll down in the share sheet to find it',
                },
                {
                  num: 3,
                  icon: '✓',
                  label: 'Tap Add',
                  detail: 'Ascentor appears on your home screen',
                },
              ].map((step, i) => (
                <div key={step.num} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {/* Left — number + connector line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: 'rgba(232,160,32,0.1)',
                      border: '1px solid rgba(232,160,32,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{
                        fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
                        fontSize: 15, fontWeight: 700, color: '#E8A020', lineHeight: 1,
                      }}>{step.icon}</span>
                    </div>
                    {i < 2 && (
                      <div style={{ width: 1, height: 20, background: 'rgba(232,160,32,0.15)', margin: '3px 0' }} />
                    )}
                  </div>
                  {/* Right — text */}
                  <div style={{ paddingTop: 6, paddingBottom: i < 2 ? 0 : 0 }}>
                    <p style={{
                      fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
                      fontSize: 13, fontWeight: 600, color: '#FAFAF8', margin: 0, marginBottom: 2,
                    }}>{step.label}</p>
                    <p style={{
                      fontFamily: "var(--font-body, 'Inter', sans-serif)",
                      fontSize: 10, color: '#6B7280',
                      letterSpacing: '0.02em', margin: 0,
                      marginBottom: i < 2 ? 6 : 0,
                    }}>{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button onClick={handleDismiss} style={{
              width: '100%',
              padding: '14px 0',
              background: 'linear-gradient(135deg, #E8A020, #C47D0E)',
              border: 'none',
              borderRadius: 12,
              fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
              fontSize: 14, fontWeight: 700,
              color: '#0C0B08',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(232,160,32,0.35)',
              letterSpacing: '0.02em',
            }}>
              Got it
            </button>
          </div>
        </div>
      </>
    );
  }

  // Install banner
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
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9989,
        animation: 'pwa-slide-up 0.4s cubic-bezier(0.16,1,0.3,1) both',
        background: '#0F0F0E',
        borderTop: '1px solid rgba(232,160,32,0.15)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.6)',
      }}>
        {/* Gold accent line at top */}
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent, #E8A020 30%, #E8A020 70%, transparent)',
          marginBottom: 0,
        }} />

        <div style={{ padding: '14px 16px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
          {/* App icon */}
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #E8A020, #C47D0E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(232,160,32,0.35)',
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
              color: '#FAFAF8', margin: 0, marginBottom: 2,
            }}>
              Add Ascentor to your home screen
            </p>
            <p style={{
              fontFamily: "var(--font-body, 'Inter', sans-serif)",
              fontSize: 10, color: '#6B7280',
              letterSpacing: '0.03em', margin: 0,
            }}>
              One tap access · Works offline
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <button onClick={handleInstall} style={{
              padding: '8px 18px',
              background: '#E8A020',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(232,160,32,0.3)',
            }}>
              Install
            </button>
            <button onClick={handleDismiss} style={{
              padding: '4px 0',
              background: 'transparent',
              border: 'none',
              fontFamily: "var(--font-body, 'Inter', sans-serif)",
              fontSize: 10, color: '#6B7280',
              cursor: 'pointer',
              textAlign: 'center',
            }}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Step({ num, text }: { num: number; text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
        style={{ background: 'rgba(245,158,11,0.12)', color: '#E8A020' }}>
        {num}
      </div>
      <p className="text-sm pt-0.5" style={{ color: '#9CA3AF' }}>{text}</p>
    </div>
  );
}
