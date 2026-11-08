'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reviewReferral } from './actions';

export default function ReviewButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState('');
  const go = (d: 'approve' | 'reverse') => start(async () => { const r = await reviewReferral(id, d); if (!r.ok) setErr(r.error ?? 'Failed'); else router.refresh(); });
  const b = { border: '1px solid #cfcac2', borderRadius: 8, padding: '6px 10px', background: '#fff', cursor: 'pointer', minHeight: 36 } as const;
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <button type="button" disabled={busy} onClick={() => go('approve')} style={b}>Approve</button>
      <button type="button" disabled={busy} onClick={() => go('reverse')} style={b}>Reverse</button>
      {err && <span role="alert" style={{ color: '#9b1c31', fontSize: 12 }}>{err}</span>}
    </span>
  );
}
