// FILE: components/subscription/PlanSection.tsx
// FIX: #5a — Next billing date visible for active/trialing/cancelled
//      #5b — displays rich card info from card_details JSONB column
//            also shows billing_cycle row (Monthly / Annual)

// ============================================================
// PLAN SECTION — Drop into AccountClient.tsx
//
// Replaces the existing {section === 'plan' && (...)} block.
// Matches your existing styling: var(--bg-card), var(--border),
// var(--accent), var(--text), var(--text-dim), etc.
// Adds: cancel flow, upgrade redirect, billing end date display.
//
// USAGE: Replace the entire `{section === 'plan' && (...)}` block
//        in AccountClient.tsx with this component, then render:
//        {section === 'plan' && <PlanSection profile={profile} userId={userId} />}
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Matches your AccountClient planMeta exactly
const PLAN_META: Record<string, {
  label: string;
  color: string;
  features: string[];
  missing: string[];
  upgradeTo: string | null;
  upgradeLabel: string | null;
}> = {
  free: {
    label: 'Free',
    color: '#7A7260',
    features: ['Sage (3 sessions/month)', '1 mentorship circle', 'Goal tracking'],
    missing: ['Expert sessions', 'Courses & learning', 'Unlimited Sage', 'Export history'],
    upgradeTo: 'explorer',
    upgradeLabel: 'Start Free Trial',
  },
  explorer: {
    label: 'Explorer',
    color: '#14B8A6',
    features: ['Sage (10 sessions/month)', '1 mentorship circle', 'Courses & learning', 'Goal tracking (3 goals)', 'Weekly reflection prompts'],
    missing: ['Live mentor sessions', 'Export history', 'Priority support'],
    upgradeTo: 'builder',
    upgradeLabel: 'Upgrade to Builder',
  },
  builder: {
    label: 'Builder',
    color: '#E8A020',
    features: ['Sage (unlimited sessions)', 'Up to 3 mentorship circles', 'Live mentor sessions', 'Human mentor matching', 'Courses & learning', 'Export session history', 'Priority support'],
    missing: ['1-on-1 quarterly expert session', 'Executive peer circle', 'Team dashboard'],
    upgradeTo: 'climber',
    upgradeLabel: 'Upgrade to Climber',
  },
  climber: {
    label: 'Climber',
    color: '#8B5CF6',
    features: ['Sage (unlimited + priority)', 'Unlimited mentorship circles', '1-on-1 expert session (quarterly)', 'Executive peer circle', 'Advanced analytics dashboard', 'Team dashboard (up to 10)', 'Dedicated account manager'],
    missing: [],
    upgradeTo: null,
    upgradeLabel: null,
  },
};

// Legacy aliases
PLAN_META.standard = { ...PLAN_META.builder, label: 'Builder' };
PLAN_META.tester   = { ...PLAN_META.builder, label: 'Tester' };
PLAN_META.pro      = { ...PLAN_META.climber, label: 'Pro' };

interface PlanSectionProps {
  profile: any;
  userId: string;
}

export function PlanSection({ profile, userId }: PlanSectionProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ success?: boolean; message: string } | null>(null);

  const plan = profile?.subscription_plan || 'free';
  const status = profile?.subscription_status;
  const subscriptionEnd = profile?.subscription_end;

  const isActive = ['active', 'trialing'].includes(status) &&
    (!subscriptionEnd || new Date(subscriptionEnd) > new Date());

  const isCancelled = status === 'cancelled';
  const isPastDue = status === 'past_due';

  const meta = PLAN_META[plan] || PLAN_META.free;

  const endDateFormatted = subscriptionEnd
    ? new Date(subscriptionEnd).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  const statusLabel = !isActive && !isCancelled
    ? 'Free Tier'
    : isCancelled
    ? 'Cancelled'
    : isPastDue
    ? 'Past Due'
    : status === 'trialing'
    ? 'Trial'
    : 'Active';

  const statusColor = isCancelled || isPastDue ? 'var(--error)'
    : !isActive ? 'var(--accent)'
    : 'var(--success)';

  const statusBg = isCancelled || isPastDue ? 'rgba(239,68,68,0.09)'
    : !isActive ? 'rgba(245,158,11,0.09)'
    : 'rgba(16,185,129,0.09)';

  const statusBorder = isCancelled || isPastDue ? 'rgba(239,68,68,0.19)'
    : !isActive ? 'rgba(245,158,11,0.19)'
    : 'rgba(16,185,129,0.19)';

  const handleCancel = async () => {
    if (!cancelConfirm) { setCancelConfirm(true); return; }
    setCancelling(true); setCancelResult(null);

    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason: 'User initiated from account page' }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to cancel');

      setCancelResult({
        success: true,
        message: data.message || `Subscription cancelled. Access continues until ${endDateFormatted || 'period end'}.`,
      });
      setCancelConfirm(false);
      // Refresh the page to reflect new status
      setTimeout(() => router.refresh(), 1500);
    } catch (err: any) {
      setCancelResult({ success: false, message: err.message });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Current Plan Card ── */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: `1px solid ${meta.color}40` }}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Current Plan</span>
            <h2 className="text-lg font-bold mt-0.5" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: meta.color }}>
              {meta.label}
            </h2>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{ background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
            {statusLabel}
          </span>
        </div>

        {/* Access end date notices */}
        {isCancelled && endDateFormatted && (
          <p className="text-xs mb-3 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', color: 'var(--accent)' }}>
            Access continues until <strong>{endDateFormatted}</strong>
          </p>
        )}
        {isPastDue && (
          <p className="text-xs mb-3 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--error)' }}>
            ⚠️ Payment failed. Please{' '}
            <a href="/checkout" style={{ color: 'var(--error)', textDecoration: 'underline' }}>
              update your payment method
            </a>
            {' '}to avoid losing access.
          </p>
        )}

        {/* Included features */}
        <div className="flex flex-col gap-1.5 mb-2">
          {meta.features.map((f) => (
            <div key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>

        {/* Missing features */}
        {meta.missing.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-4 mt-1">
            {meta.missing.map((f) => (
              <div key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-dim)', opacity: 0.5 }}>
                <span>–</span><span>{f}</span>
              </div>
            ))}
          </div>
        )}

        {/* Upgrade CTA */}
        {meta.upgradeTo && (
          <a href="/checkout"
            className="block w-full py-2.5 rounded-lg text-sm font-semibold text-center transition-all mt-4"
            style={{ background: meta.color, color: plan === 'free' || !isActive ? '#000' : '#fff' }}>
            {meta.upgradeLabel}
          </a>
        )}
      </div>

      {/* ── Billing Info ── */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Billing</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
          {isActive
            ? 'Your subscription renews automatically.'
            : isCancelled
            ? 'Subscription cancelled — no future charges.'
            : 'No active subscription. Upgrade to access all features.'}
        </p>
        {(isActive || isCancelled) && (
          <div className="flex flex-col gap-2">
            {endDateFormatted && (
              <InfoRow
                label={isCancelled ? 'Access until' : 'Next billing date'}
                value={endDateFormatted}
              />
            )}
            {profile?.billing_cycle && (
              <InfoRow label="Billing cycle" value={profile.billing_cycle === 'annual' ? 'Annual' : 'Monthly'} />
            )}
            {(() => {
              const card = profile?.card_details;
              if (card?.last4) {
                const brand = (card.card_type || card.channel || 'Card').replace(/^\w/, (c: string) => c.toUpperCase());
                const expiry = card.exp_month && card.exp_year ? ` · ${card.exp_month}/${card.exp_year}` : '';
                return <InfoRow label="Payment method" value={`${brand} •••• ${card.last4}${expiry}`} />;
              }
              if (profile?.payment_method) {
                return <InfoRow label="Payment method" value={profile.payment_method} />;
              }
              return null;
            })()}
          </div>
        )}
      </div>

      {/* ── Cancel Subscription ── */}
      {isActive && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Cancel Subscription</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
            You'll keep access until{' '}
            <strong style={{ color: 'var(--text-muted)' }}>{endDateFormatted || 'your billing period ends'}</strong>.
            No refunds for the current period.
          </p>

          {!cancelConfirm ? (
            <button
              onClick={() => setCancelConfirm(true)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
              Cancel Subscription
            </button>
          ) : (
            <div className="rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--error)' }}>
                Are you sure? You'll lose access to {meta.label} features on {endDateFormatted || 'period end'}.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  {cancelling ? 'Cancelling...' : 'Yes, cancel'}
                </button>
                <button
                  onClick={() => { setCancelConfirm(false); setCancelResult(null); }}
                  className="px-4 py-2 rounded-lg text-xs"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Keep plan
                </button>
              </div>
            </div>
          )}

          {cancelResult && (
            <div className="mt-3 rounded-lg p-3"
              style={{
                background: cancelResult.success ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${cancelResult.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}>
              <p className="text-xs" style={{ color: cancelResult.success ? 'var(--success)' : 'var(--error)' }}>
                {cancelResult.message}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Resubscribe CTA (for cancelled users) ── */}
      {isCancelled && (
        <div className="rounded-xl p-5 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>Changed your mind?</p>
          <a href="/checkout"
            className="inline-block px-6 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#000' }}>
            Reactivate Subscription
          </a>
        </div>
      )}
    </div>
  );
}

// ── Shared InfoRow (matches AccountClient's existing component) ──
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}
