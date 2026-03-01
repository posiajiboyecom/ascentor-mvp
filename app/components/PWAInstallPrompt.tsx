'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'android' | 'ios' | 'desktop-chrome' | 'desktop-edge' | 'desktop-safari' | 'desktop-firefox' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';

  const isAndroid = /Android/.test(ua);
  if (isAndroid) return 'android';

  // Desktop browsers
  const isEdge = /Edg\//.test(ua);
  if (isEdge) return 'desktop-edge';

  const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua);
  if (isChrome) return 'desktop-chrome';

  const isSafari = /Safari\//.test(ua) && !/Chrome/.test(ua);
  if (isSafari) return 'desktop-safari';

  const isFirefox = /Firefox\//.test(ua);
  if (isFirefox) return 'desktop-firefox';

  return 'unknown';
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err);
      });
    }

    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const detected = detectPlatform();
    setPlatform(detected);

    // Check dismissal (7-day cooldown)
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Android + Desktop Chrome/Edge: listen for native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: show after 3 visits
    if (detected === 'ios') {
      const visits = parseInt(localStorage.getItem('pwa-visits') || '0') + 1;
      localStorage.setItem('pwa-visits', String(visits));
      if (visits >= 3) setShowBanner(true);
    }

    // Desktop Safari / Firefox: always show manual guide banner
    // (these browsers never fire beforeinstallprompt)
    if (detected === 'desktop-safari' || detected === 'desktop-firefox') {
      setShowBanner(true);
    }

    // Desktop Chrome/Edge fallback: if beforeinstallprompt doesn't fire
    // within 3s (e.g. already installed or criteria not met), don't show
    // This is handled naturally — banner only shows if event fires

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    // Native prompt available (Android, Desktop Chrome/Edge)
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
      setShowBanner(false);
      return;
    }

    // iOS, Desktop Safari, Firefox — show manual guide
    setShowManualGuide(true);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowManualGuide(false);
    localStorage.setItem('pwa-banner-dismissed', String(Date.now()));
  };

  if (isInstalled || !showBanner) return null;

  // ── MANUAL INSTALL GUIDE MODAL ──────────────────────────────
  if (showManualGuide) {
    const steps = getManualSteps(platform);
    return (
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
      >
        <div
          className="w-full max-w-md mx-4 mb-6 rounded-2xl p-5 animate-fade-up"
          style={{ background: '#1A1D2E', border: '1px solid rgba(245,158,11,0.15)' }}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold" style={{ color: '#F1F0EB' }}>
              Install Ascentor
            </h3>
            <button onClick={handleDismiss} className="text-xl leading-none" style={{ color: '#5A5955' }}>
              &times;
            </button>
          </div>

          <p className="text-xs mb-4" style={{ color: '#8B8A85' }}>
            {platformLabel(platform)}
          </p>

          <div className="flex flex-col gap-3">
            {steps.map((text, i) => (
              <Step key={i} num={i + 1} text={text} />
            ))}
          </div>

          <button
            onClick={handleDismiss}
            className="w-full mt-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: '#E8A020', color: '#000' }}
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  // ── INSTALL BANNER ───────────────────────────────────────────
  const isDesktopManual = platform === 'desktop-safari' || platform === 'desktop-firefox';

  return (
    <div
      className="fixed bottom-20 left-3 right-3 z-[90] animate-fade-up"
      style={{ maxWidth: '440px', margin: '0 auto 0 auto', left: 0, right: 0, position: 'fixed', bottom: '80px' }}
    >
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, #1A1D2E 0%, #141724 100%)',
          border: '1px solid rgba(245,158,11,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          margin: '0 12px',
        }}
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          📲
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: '#F1F0EB' }}>
            Add Ascentor to {isDesktopManual ? 'your computer' : 'Home Screen'}
          </p>
          <p className="text-[11px]" style={{ color: '#8B8A85' }}>
            {isDesktopManual
              ? 'Works offline · Instant access from your desktop'
              : 'Quick access · Works offline'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ color: '#5A5955' }}
          >
            Later
          </button>
          <button
            onClick={handleInstall}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: '#E8A020', color: '#000' }}
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

// ── HELPERS ───────────────────────────────────────────────────

function platformLabel(platform: Platform): string {
  switch (platform) {
    case 'ios': return 'Follow these steps in Safari on your iPhone or iPad:';
    case 'desktop-safari': return 'Follow these steps in Safari on your Mac:';
    case 'desktop-firefox': return 'Follow these steps in Firefox:';
    default: return 'Follow these steps to install:';
  }
}

function getManualSteps(platform: Platform): React.ReactNode[] {
  switch (platform) {
    case 'ios':
      return [
        <>Tap the <strong style={{ color: '#F1F0EB' }}>Share</strong> button (⬆) at the bottom of Safari</>,
        <>Scroll down and tap <strong style={{ color: '#F1F0EB' }}>"Add to Home Screen"</strong></>,
        <>Tap <strong style={{ color: '#F1F0EB' }}>"Add"</strong> — Ascentor will appear on your home screen</>,
      ];
    case 'desktop-safari':
      return [
        <>Click <strong style={{ color: '#F1F0EB' }}>File</strong> in the menu bar</>,
        <>Select <strong style={{ color: '#F1F0EB' }}>"Add to Dock"</strong></>,
        <>Click <strong style={{ color: '#F1F0EB' }}>"Add"</strong> — Ascentor will appear in your Dock</>,
      ];
    case 'desktop-firefox':
      return [
        <>Firefox doesn't support PWA install directly</>,
        <>For the best experience, open Ascentor in <strong style={{ color: '#F1F0EB' }}>Google Chrome</strong> or <strong style={{ color: '#F1F0EB' }}>Microsoft Edge</strong></>,
        <>Then click the <strong style={{ color: '#F1F0EB' }}>install icon (⊕)</strong> in the address bar</>,
      ];
    default:
      return [
        <>Click the <strong style={{ color: '#F1F0EB' }}>install icon (⊕)</strong> in your browser's address bar</>,
        <>Click <strong style={{ color: '#F1F0EB' }}>"Install"</strong> in the dialog that appears</>,
        <>Ascentor will open as a standalone app on your desktop</>,
      ];
  }
}

function Step({ num, text }: { num: number; text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
        style={{ background: 'rgba(245,158,11,0.12)', color: '#E8A020', minWidth: '24px' }}
      >
        {num}
      </div>
      <p className="text-sm pt-0.5" style={{ color: '#C5C4BF' }}>{text}</p>
    </div>
  );
}
