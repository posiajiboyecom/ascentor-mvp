'use client';

// "Have a reward code?" box: Settings > Billing and /redeem.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift } from 'lucide-react';
import { redeemRewardCode } from '@/app/redeem/actions';

export default function RedeemCode({ initialCode = '', title = 'Have a reward code?', after }: { initialCode?: string; title?: string; after?: React.ReactNode }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setMsg(null);
    start(async () => {
      const r = await redeemRewardCode(code);
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  };

  return (
    <section className="rx-card st" aria-labelledby="rd-h">
      <div className="rx-row" style={{ alignItems: 'center', gap: 10 }}>
        <span className="rx-dimdot" aria-hidden><Gift /></span>
        <p id="rd-h" className="rx-sl" style={{ margin: 0 }}>{title}</p>
      </div>
      <p className="rx-p">Enter it here to add the free months to your account. No card is needed.</p>
      <form onSubmit={submit} className="rx-row" style={{ alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <label className="rx-fld" style={{ flex: '1 1 220px', margin: 0 }}>
          <span className="rx-label">Code</span>
          <input className="rx-in" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="TES-XXXX-XXXX"
            autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={20} style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '0.06em' }} />
        </label>
        <button type="submit" className="rx-btn primary" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Use code'}</button>
      </form>
      {msg && <p className={msg.ok ? 'rx-banner' : 'rx-banner err'} role={msg.ok ? 'status' : 'alert'} style={{ marginTop: 4 }}>{msg.text}</p>}
      {msg?.ok && after}
    </section>
  );
}
