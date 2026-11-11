'use client';

// "On this phone": install Ascentor as an app and turn on push notifications for this device.
// Android and desktop Chrome can install from a button. On iPhone it works too, but only after Ascentor is added to the
// Home Screen from Safari and opened from there. Push needs that on iPhone, so the card says so plainly.

import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { usePush } from '@/components/PushPermission';
import { useToast } from '@/components/rx/Toast';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default function DeviceCard() {
  const toast = useToast();
  const { state, subscribe, unsubscribe } = usePush();
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => { e.preventDefault(); setInstall(e as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setInstall(null); toast('Ascentor is installed.'); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, [toast]);

  const on = state === 'granted';
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');

  async function sendTest() {
    setTesting(true); setTestMsg('');
    try {
      // Make sure this device is registered to you first (permission is already granted, so no prompt).
      if (!on || !(await subscribe())) { setTestMsg('Turn notifications on first.'); return; }
      const r = await fetch('/api/push/test', { method: 'POST', credentials: 'include' });
      const j = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
      setTestMsg(j.message ?? j.error ?? 'Something went wrong.');
    } catch { setTestMsg('We couldn’t reach the server.'); }
    finally { setTesting(false); }
  }
  const needsHomeScreen = ios && !installed;

  async function toggle() {
    setBusy(true);
    try {
      if (on) { await unsubscribe(); toast('Push notifications are off on this device.'); }
      else {
        const ok = await subscribe();
        toast(ok ? 'Push notifications are on for this device.' : state === 'denied' ? 'Notifications are blocked in your browser settings.' : 'We couldn’t turn on notifications here.');
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="rx-card rx-stack">
      <p className="rx-label">On this phone</p>

      {!installed && install && (
        <div className="rx-between">
          <div><p className="rx-p">Install Ascentor</p><p className="rx-sm">Opens like an app, from your home screen.</p></div>
          <button type="button" className="rx-btn secondary" onClick={() => { void install.prompt().then(() => install.userChoice).then((c) => { if (c.outcome === 'accepted') toast('Installing Ascentor.'); }); }}>Install</button>
        </div>
      )}
      {!installed && !install && !ios && <p className="rx-sm">To install Ascentor, open this page in Chrome and use the browser menu, then Install app.</p>}
      {needsHomeScreen && (
        <div className="rx-soft rx-stack-sm">
          <p className="rx-p rx-strong"><Smartphone aria-hidden style={{ width: 16, height: 16, verticalAlign: '-3px', marginRight: 6 }} />On iPhone</p>
          <p className="rx-sm">Open Ascentor in Safari, tap the Share button, then Add to Home Screen. Open Ascentor from your home screen, then come back here to turn on notifications.</p>
        </div>
      )}

      <div className="rx-between">
        <div><p className="rx-p">Push notifications</p><p className="rx-sm">{state === 'unsupported' ? 'Not available on this browser.' : state === 'denied' ? 'Blocked in your browser settings.' : on ? 'On for this device.' : 'Off for this device.'}</p></div>
        <button type="button" className="rx-toggle" aria-label="Push notifications on this device" aria-pressed={on} disabled={busy || state === 'unsupported' || needsHomeScreen} onClick={() => void toggle()} />
      </div>
      {on && (
        <div className="rx-row" style={{ alignItems: 'center', gap: 12 }}>
          <button type="button" className="rx-btn secondary" disabled={testing} onClick={() => void sendTest()}>{testing ? 'Sending…' : 'Send a test'}</button>
          {testMsg && <p className="rx-sm" role="status" style={{ margin: 0 }}>{testMsg}</p>}
        </div>
      )}
      <p className="rx-sm">You choose which events notify you in Notifications above. Email is separate.</p>
    </div>
  );
}
