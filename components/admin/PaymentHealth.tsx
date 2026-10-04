'use client';

// Payment health panel for the admin overview.
// Reads /api/admin/payments (abandoned / pending / failed / completed checkout
// attempts over the last 30 days) and offers a manual "Reconcile now", which
// runs the same sweep as the daily Vercel cron.

import { useCallback, useEffect, useState } from 'react';

interface Bucket { count: number; valueKobo: number }
interface Health {
  windowDays: number;
  abandoned: Bucket;
  pending: Bucket;
  failed: Bucket;
  success: Bucket;
  duplicate: Bucket;
  abandonedByKind: { summit: number; subscription: number };
  completionRate: number | null;
}
interface ReconcileResult {
  checked: number; recovered: number; failed: number; abandoned: number;
  adminNotified: number; recoveryEmailsSent: number; errors: number;
}

const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;

export default function PaymentHealth() {
  const [health, setHealth]   = useState<Health | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote]       = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payments', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 403 ? 'No access to payment data' : 'Could not load payment data');
      setHealth(await res.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reconcile = async () => {
    setRunning(true);
    setNote(null);
    try {
      const res = await fetch('/api/admin/payments', { method: 'POST' });
      const body: ReconcileResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(body.error || 'Reconciliation failed');
      setNote(
        `Checked ${body.checked}: ${body.recovered} recovered, ${body.failed} failed, ${body.abandoned} newly abandoned` +
        (body.recoveryEmailsSent ? `, ${body.recoveryEmailsSent} recovery email(s) sent` : '') + '.'
      );
      await load();
    } catch (e) {
      setNote((e as Error).message);
    }
    setRunning(false);
  };

  if (error && !health) return null; // moderators without payments.view see nothing

  const attention = (health?.abandoned.count ?? 0) + (health?.failed.count ?? 0) + (health?.duplicate.count ?? 0);

  return (
    <div className="rounded-xl p-5 mb-5 ledger-panel">
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <span className="text-sm font-semibold ledger-h2" style={{ fontSize: 15 }}>
          Payments - last {health?.windowDays ?? 30} days
        </span>
        <button
          type="button"
          className="ledger-btn ledger-btn-ghost"
          onClick={reconcile}
          disabled={running}
          title="Re-check pending payments with Paystack, recover paid ones, flag abandoned ones"
        >
          {running ? 'Reconciling…' : 'Reconcile now'}
        </button>
      </div>

      {!health ? (
        <div className="text-xs ledger-mono">Loading&hellip;</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <Tile label="Completed" count={health.success.count} value={naira(health.success.valueKobo)}
                sub={health.completionRate == null ? undefined : `${health.completionRate}% completion`} color="var(--ledger-good)" />
          <Tile label="Abandoned" count={health.abandoned.count} value={naira(health.abandoned.valueKobo)}
                sub={`${health.abandonedByKind.summit} summit / ${health.abandonedByKind.subscription} plan`}
                color={health.abandoned.count ? 'var(--ledger-gold)' : 'var(--ledger-ink-soft)'} />
          <Tile label="In progress" count={health.pending.count} value={naira(health.pending.valueKobo)}
                sub="checked daily" color="var(--ledger-info)" />
          <Tile label="Failed / rejected" count={health.failed.count} value={naira(health.failed.valueKobo)}
                color={health.failed.count ? 'var(--ledger-gold)' : 'var(--ledger-ink-soft)'} />
          <Tile label="Duplicate (refund)" count={health.duplicate.count} value={naira(health.duplicate.valueKobo)}
                color={health.duplicate.count ? 'var(--ledger-gold)' : 'var(--ledger-ink-soft)'} />
        </div>
      )}

      {health && attention > 0 && (
        <p className="text-xs mt-3 ledger-mono" style={{ color: 'var(--ledger-ink-soft)' }}>
          {attention} attempt{attention === 1 ? '' : 's'} need attention. Abandoned checkouts are emailed a
          recovery link automatically; duplicates need a manual refund in Paystack.
        </p>
      )}
      {note && <p className="text-xs mt-2 ledger-mono">{note}</p>}
    </div>
  );
}

function Tile(props: { label: string; count: number; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-lg p-3" style={{ border: '1px solid var(--ledger-line, rgba(128,128,128,0.2))' }}>
      <div className="text-xl ledger-number" style={{ color: props.color, fontSize: 24 }}>{props.count.toLocaleString()}</div>
      <div className="text-[11px] ledger-label" style={{ textTransform: 'none', letterSpacing: 0 }}>{props.label}</div>
      <div className="text-[11px] ledger-mono mt-1">{props.value}</div>
      {props.sub && <div className="text-[10px] ledger-mono" style={{ opacity: 0.7 }}>{props.sub}</div>}
    </div>
  );
}
