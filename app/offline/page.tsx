'use client'

import { WifiOff } from 'lucide-react';
import '@/styles/rx.css';
import '@/styles/rx-entry.css';

export default function OfflinePage() {
  return (
    <div className="rx rx-entry rx-entry-center">
      <div className="rx-card rx-entry-card-empty">
        <span className="rx-dimdot" style={{ width: 72, height: 72, borderRadius: 20 }}>
          <WifiOff aria-hidden style={{ width: 34, height: 34 }} />
        </span>
        <p className="rx-h2">You’re offline</p>
        <p className="rx-p" style={{ color: 'var(--rx-muted)', maxWidth: 420 }}>
          This page needs a connection, and Ascentor doesn’t keep your pages on this device. Check your signal and try again. Check-ins you write while offline send when you’re back.
        </p>
        <button type="button" className="rx-btn primary" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </div>
  );
}
