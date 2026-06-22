'use client';

// components/admin/ExportPanel.tsx
// ============================================================
// Self-contained UI for exporting community_messages and/or
// coaching_sessions via GET /api/admin/export. Drop into any
// admin page — used in app/admin/coaching/page.tsx, which
// already has both a "coaching" and "community" tab in one
// place.
//
// Downloads via fetch() + Blob rather than a plain <a href>
// navigation, so the Supabase session token can be sent as a
// proper Authorization header (matching every other /api/admin/*
// call in this codebase) instead of being exposed in the URL.
// This also means fetch-level errors (401 if the session expired,
// 500 if the export failed) surface as a message in this panel
// instead of the browser silently navigating to a raw JSON error.
//
// Styling: The Ledger (styles/admin-ledger.css). Assumes this
// component is rendered inside the [data-ledger] scope, which
// is true for everything under /admin since app/admin/layout.tsx
// wraps all children in <AdminThemeProvider>.
// ============================================================

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Source = 'community' | 'coaching' | 'both';
type Format = 'csv' | 'json' | 'pdf';

const SOURCE_OPTIONS: { value: Source; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'coaching', label: 'AI Coaching' },
  { value: 'community', label: 'Community' },
];

const FORMAT_OPTIONS: { value: Format; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'pdf', label: 'PDF Summary' },
];

export default function ExportPanel() {
  const supabase = createClient();
  const [source, setSource] = useState<Source>('both');
  const [format, setFormat] = useState<Format>('csv');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Your session has expired — refresh the page and try again.');
        setBusy(false);
        return;
      }

      const params = new URLSearchParams({ source, format });
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      // fetch + blob, NOT a direct <a href> navigation — this lets
      // us send the Authorization header properly rather than
      // relying on the route's query-param auth fallback, and
      // gives us a place to surface fetch-level errors (401, 500)
      // instead of the browser silently navigating to a JSON
      // error body.
      const res = await fetch(`/api/admin/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || `Export failed (${res.status})`);
        setBusy(false);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `ascentor-export-${source}.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[export panel]', err);
      setError('Export failed — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ledger-panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 className="ledger-h2" style={{ fontSize: 17 }}>Export chat data</h3>
          <p className="ledger-mono" style={{ marginTop: 4 }}>Community messages and AI coaching sessions</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
        <div>
          <label className="ledger-label" style={{ display: 'block', marginBottom: 6 }}>Source</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SOURCE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSource(opt.value)}
                className={`ledger-btn ${source === opt.value ? 'ledger-btn-primary' : 'ledger-btn-ghost'}`}
                style={{ fontSize: 10.5 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="ledger-label" style={{ display: 'block', marginBottom: 6 }}>Format</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FORMAT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFormat(opt.value)}
                className={`ledger-btn ${format === opt.value ? 'ledger-btn-primary' : 'ledger-btn-ghost'}`}
                style={{ fontSize: 10.5 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 18 }}>
        <div>
          <label className="ledger-label" style={{ display: 'block', marginBottom: 6 }}>From (optional)</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            max={to || undefined}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 'var(--ledger-radius-sm)',
              border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)',
              color: 'var(--ledger-ink)', fontFamily: 'var(--ledger-font-mono)', fontSize: 12,
            }}
          />
        </div>
        <div>
          <label className="ledger-label" style={{ display: 'block', marginBottom: 6 }}>To (optional)</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            min={from || undefined}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 'var(--ledger-radius-sm)',
              border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)',
              color: 'var(--ledger-ink)', fontFamily: 'var(--ledger-font-mono)', fontSize: 12,
            }}
          />
        </div>
      </div>

      {error && (
        <div className="ledger-tag ledger-tag-flag" style={{ display: 'block', marginBottom: 14, padding: '8px 12px' }}>
          {error}
        </div>
      )}

      <button onClick={handleExport} disabled={busy} className="ledger-btn ledger-btn-primary" style={{ width: '100%' }}>
        {busy ? 'Preparing export…' : `Export ${source === 'both' ? 'all chat data' : source === 'coaching' ? 'AI coaching sessions' : 'community messages'}`}
      </button>

      <p className="ledger-mono" style={{ marginTop: 10, fontSize: 10, opacity: 0.7 }}>
        Leave dates blank to export all-time. Large exports (20,000+ messages or 10,000+ sessions) are capped — narrow the date range if you hit the limit.
      </p>
    </div>
  );
}
