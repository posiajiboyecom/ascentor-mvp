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
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
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
      <div className="fixed inset-0 z-[100] flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className="w-full max-w-md mx-4 mb-4 rounded-2xl p-5 animate-fade-up"
          style={{ background: '#1A1D2E', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold" style={{ color: '#F1F0EB' }}>
              Install Ascentor
            </h3>
            <button onClick={handleDismiss} className="text-lg" style={{ color: '#5A5955' }}>
              &times;
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <Step num={1} text={<>Tap the <strong>Share</strong> button <span className="inline-block text-base align-middle">&#xFEFF;⬆</span> at the bottom of Safari</>} />
            <Step num={2} text={<>Scroll down and tap <strong>"Add to Home Screen"</strong></>} />
            <Step num={3} text={<>Tap <strong>"Add"</strong> — Ascentor will appear on your home screen</>} />
          </div>
          <button onClick={handleDismiss}
            className="w-full mt-4 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: '#E8A020', color: '#000' }}>
            Got it
          </button>
        </div>
      </div>
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
        background: '#1A1814',
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
              fontFamily: "'Syne', system-ui, sans-serif",
              fontSize: 14, fontWeight: 700,
              color: '#FEF9EC', margin: 0, marginBottom: 2,
            }}>
              Add Ascentor to your home screen
            </p>
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10, color: '#7A7260',
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
              fontFamily: "'Syne', system-ui, sans-serif",
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
              fontFamily: "'DM Mono', monospace",
              fontSize: 10, color: '#4A4438',
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
      <p className="text-sm pt-0.5" style={{ color: '#C5C4BF' }}>{text}</p>
    </div>
  );
}
