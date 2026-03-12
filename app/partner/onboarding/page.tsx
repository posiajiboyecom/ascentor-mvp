'use client';

// ============================================================
// app/partner/onboarding/page.tsx
//
// Step-by-step onboarding checklist for new partners.
// Shown automatically until all steps are complete (onboarded_at is set).
//
// Steps:
//   1. Brand — Upload logo, set platform name
//   2. Paystack — Connect payment account
//   3. Pricing — Set membership prices
//   4. Members — Invite first member
//   5. Go live — Checklist complete, sets onboarded_at
// ============================================================

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ChecklistState {
  has_logo:          boolean;
  has_platform_name: boolean;
  has_paystack_key:  boolean;
  has_custom_pricing: boolean;
  has_member:        boolean;
  onboarded_at:      string | null;
}

const STEPS = [
  {
    id:          'brand',
    title:       'Customise your brand',
    description: 'Upload a logo and set your platform name and colours.',
    href:        '/partner/brand',
    checks:      (s: ChecklistState) => s.has_logo && s.has_platform_name,
    partial:     (s: ChecklistState) => s.has_platform_name && !s.has_logo,
    partialMsg:  'Platform name set — add a logo to complete this step',
  },
  {
    id:          'paystack',
    title:       'Connect Paystack',
    description: 'Add your Paystack secret key so members can pay and your revenue flows to you.',
    href:        '/partner/settings',
    checks:      (s: ChecklistState) => s.has_paystack_key,
    partial:     (_: ChecklistState) => false,
    partialMsg:  '',
  },
  {
    id:          'pricing',
    title:       'Set your membership prices',
    description: 'Choose plan names and prices in Naira for your community.',
    href:        '/partner/pricing',
    checks:      (s: ChecklistState) => s.has_custom_pricing,
    partial:     (_: ChecklistState) => false,
    partialMsg:  '',
  },
  {
    id:          'members',
    title:       'Invite your first member',
    description: 'Send your first invite to test the full experience end-to-end.',
    href:        '/partner/members',
    checks:      (s: ChecklistState) => s.has_member,
    partial:     (_: ChecklistState) => false,
    partialMsg:  '',
  },
];

export default function PartnerOnboardingPage() {
  const supabase = createClient();
  const router   = useRouter();

  const [state,         setState]         = useState<ChecklistState | null>(null);
  const [partnerId,     setPartnerId]     = useState<string | null>(null);
  const [partnerName,   setPartnerName]   = useState('');
  const [subdomain,     setSubdomain]     = useState('');
  const [markingDone,   setMarkingDone]   = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // Load partner core data
      const { data: partner } = await supabase
        .from('partners')
        .select(
          'id, name, subdomain, onboarded_at, brand, plan_overrides, ' +
          'paystack_secret_key_enc'
        )
        .eq('owner_id', user.id)
        .single();

      if (!partner) { router.push('/dashboard'); return; }

      setPartnerId(partner.id);
      setPartnerName(partner.name);
      setSubdomain(partner.subdomain);

      // If already onboarded, redirect to brand
      if (partner.onboarded_at) {
        router.push('/partner/brand');
        return;
      }

      // Check: member count
      const { count: memberCount } = await supabase
        .from('partner_members')
        .select('id', { count: 'exact', head: true })
        .eq('partner_id', partner.id)
        .neq('status', 'removed');

      const brand: any        = partner.brand || {};
      const overrides: any    = partner.plan_overrides || {};

      setState({
        has_logo:           Boolean(brand.logo_url),
        has_platform_name:  Boolean(brand.platform_name?.trim()),
        has_paystack_key:   Boolean((partner as any).paystack_secret_key_enc),
        has_custom_pricing: Boolean(
          overrides.explorer_monthly_ngn ||
          overrides.builder_monthly_ngn  ||
          overrides.climber_monthly_ngn
        ),
        has_member:         (memberCount || 0) > 0,
        onboarded_at:       partner.onboarded_at,
      });

      setLoading(false);
    };
    load();
  }, []);

  const completedCount = state
    ? STEPS.filter(s => s.checks(state)).length
    : 0;
  const allDone = completedCount === STEPS.length;
  const progress = Math.round((completedCount / STEPS.length) * 100);

  const handleMarkComplete = async () => {
    if (!partnerId || !allDone) return;
    setMarkingDone(true);
    setError('');

    // Set onboarded_at via a direct Supabase update
    // (safe: owner_id RLS allows this)
    const { error: updateErr } = await supabase
      .from('partners')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', partnerId);

    if (updateErr) {
      setError('Could not mark as complete. Please try again.');
      setMarkingDone(false);
      return;
    }

    router.push(`/partner/brand?onboarded=1`);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading checklist...</p>
      </div>
    );
  }

  if (!state) return null;

  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }} className="animate-fade-up">

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 28, color: 'var(--text)', marginBottom: 6,
        }}>
          Set up {partnerName}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          Complete these steps to launch your platform at{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
            {subdomain}.ascentorbi.com
          </span>
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Progress
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: completedCount === STEPS.length ? 'var(--success)' : 'var(--accent)' }}>
            {completedCount} / {STEPS.length} complete
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: allDone ? 'var(--success)' : 'var(--accent)',
            width: `${progress}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STEPS.map((step, idx) => {
          const done     = step.checks(state);
          const partial  = !done && step.partial(state);

          return (
            <div
              key={step.id}
              style={{
                background:   done ? 'rgba(16,185,129,0.04)' : 'var(--bg-card)',
                border:       `1px solid ${done ? 'rgba(16,185,129,0.20)' : 'var(--border)'}`,
                borderRadius: 12,
                padding:      '16px 18px',
                display:      'flex',
                alignItems:   'flex-start',
                gap:          14,
                transition:   'border-color 0.2s',
              }}
            >
              {/* Step number / checkmark */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done
                  ? 'rgba(16,185,129,0.12)'
                  : partial
                    ? 'rgba(232,160,32,0.08)'
                    : 'var(--bg-input)',
                border: `1px solid ${done
                  ? 'rgba(16,185,129,0.3)'
                  : partial
                    ? 'rgba(232,160,32,0.3)'
                    : 'var(--border)'}`,
              }}>
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: partial ? '#E8A020' : 'var(--text-dim)',
                  }}>
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 14, fontWeight: 700,
                  color: done ? 'var(--success)' : 'var(--text)',
                  marginBottom: 3,
                  textDecoration: done ? 'line-through' : 'none',
                  opacity: done ? 0.7 : 1,
                }}>
                  {step.title}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  {partial ? step.partialMsg : step.description}
                </p>
              </div>

              {/* Action button */}
              {!done && (
                <Link
                  href={step.href}
                  style={{
                    flexShrink: 0, padding: '7px 16px', borderRadius: 8,
                    background: partial ? 'rgba(232,160,32,0.10)' : 'var(--accent)',
                    color:      partial ? '#E8A020' : '#000',
                    border:     partial ? '1px solid rgba(232,160,32,0.25)' : 'none',
                    fontSize: 12, fontWeight: 700, textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {partial ? 'Continue →' : 'Set up →'}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Go live CTA */}
      <div style={{
        marginTop: 28, padding: '20px 22px', borderRadius: 14,
        background: allDone ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
        border: `1px solid ${allDone ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: allDone ? 'var(--success)' : 'var(--text)', marginBottom: 4 }}>
            {allDone ? '🎉 You\'re ready to launch!' : 'Complete all steps to go live'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            {allDone
              ? `Your platform will be live at ${subdomain}.ascentorbi.com. Click below to finalise your launch.`
              : `${STEPS.length - completedCount} step${STEPS.length - completedCount !== 1 ? 's' : ''} remaining before your platform is ready.`
            }
          </p>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#EF4444', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleMarkComplete}
          disabled={!allDone || markingDone}
          style={{
            padding: '12px 24px', borderRadius: 10, border: 'none',
            background: allDone ? 'var(--success)' : 'var(--bg-input)',
            color: allDone ? '#fff' : 'var(--text-dim)',
            fontSize: 14, fontWeight: 700,
            cursor: allDone && !markingDone ? 'pointer' : 'not-allowed',
            opacity: markingDone ? 0.6 : 1,
            transition: 'all 0.2s',
            alignSelf: 'flex-start',
          }}
        >
          {markingDone ? 'Launching...' : '🚀 Mark as live & go to dashboard'}
        </button>
      </div>

      {/* Skip link */}
      <p style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
        <Link href="/partner/brand" style={{ color: 'var(--text-dim)', textDecoration: 'underline' }}>
          Skip and go to admin panel →
        </Link>
      </p>
    </div>
  );
}
