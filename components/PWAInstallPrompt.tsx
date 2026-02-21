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
            style={{ background: '#F59E0B', color: '#000' }}>
            Got it
          </button>
        </div>
      </div>
    );
  }

  // Install banner
  return (
    <div className="fixed bottom-20 left-3 right-3 z-[90] animate-fade-up"
      style={{ maxWidth: '420px', margin: '0 auto' }}>
      <div className="rounded-xl p-4 flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, #1A1D2E 0%, #141724 100%)',
          border: '1px solid rgba(245,158,11,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          ⬆
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#F1F0EB' }}>
            Add Ascentor to Home Screen
          </p>
          <p className="text-[11px]" style={{ color: '#8B8A85' }}>
            Quick access, works offline
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ color: '#5A5955' }}>
            Later
          </button>
          <button onClick={handleInstall}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: '#F59E0B', color: '#000' }}>
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ num, text }: { num: number; text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
        style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
        {num}
      </div>
      <p className="text-sm pt-0.5" style={{ color: '#C5C4BF' }}>{text}</p>
    </div>
  );
}
