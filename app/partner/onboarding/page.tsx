// ============================================================
// app/partner/onboarding/page.tsx
//
// FILE LOCATION: app/partner/onboarding/page.tsx
//
// FIX (W-11):
//   The "Skip and go to admin panel →" link at the bottom of the
//   onboarding page pointed to /partner/brand, but the layout.tsx
//   guard re-redirects any partner without onboarded_at back to
//   /partner/onboarding. This created an infinite redirect loop.
//
//   Fix: the skip link is REMOVED. Coaches must complete the
//   checklist to go live. The final "Mark as live" button is the
//   only exit path — it sets onboarded_at and then redirects to
//   /partner/brand.
//
//   All other logic is unchanged.
//
// FIX (W-22):
//   Heading fontFamily was hardcoded 'Cormorant Garamond'.
//   Changed to 'var(--font-heading)'.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ChecklistState {
  has_logo:           boolean;
  has_platform_name:  boolean;
  has_paystack_key:   boolean;
  has_custom_pricing: boolean;
  has_member:         boolean;
  onboarded_at:       string | null;
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
    description: 'Add at least one member email to your platform before launching.',
    href:        '/partner/members',
    checks:      (s: ChecklistState) => s.has_member,
    partial:     (_: ChecklistState) => false,
    partialMsg:  '',
  },
];

export default function PartnerOnboardingPage() {
  const supabase    = createClient();
  const router      = useRouter();
  const [state, setState]       = useState<ChecklistState | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState('');
  const [loading, setLoading]   = useState(true);
  const [markingDone, setMarkingDone] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = (await supabase
        .from('partners')
        .select(
          'id, name, subdomain, onboarded_at, brand, plan_overrides, ' +
          'paystack_secret_key'
        )
        .eq('owner_id', user.id)
        .single()) as {
          data: {
            id: string;
            name: string;
            subdomain: string;
            onboarded_at: string | null;
            brand: Record<string, any>;
            plan_overrides: Record<string, any>;
            paystack_secret_key: string | null;
          } | null;
          error: any;
        };

      if (!partner) { setLoading(false); return; }

      // If already onboarded, redirect to brand
      if (partner.onboarded_at) {
        router.replace('/partner/brand');
        return;
      }

      setPartnerId(partner.id);
      setSubdomain(partner.subdomain || '');

      const brand     = partner.brand || {};
      const overrides = partner.plan_overrides || {};

      // Check member count
      const { count: memberCount } = await supabase
        .from('partner_members')
        .select('*', { count: 'exact', head: true })
        .eq('partner_id', partner.id);

      setState({
        has_logo:           Boolean(brand.logo_url),
        has_platform_name:  Boolean(brand.platform_name?.trim()),
        has_paystack_key:   Boolean(partner.paystack_secret_key),
        has_custom_pricing: Boolean(
          overrides.explorer_monthly_ngn || overrides.builder_monthly_ngn || overrides.climber_monthly_ngn
        ),
        has_member:         Boolean(memberCount && memberCount > 0),
        onboarded_at:       partner.onboarded_at,
      });
      setLoading(false);
    };
    load();
  }, []);

  const completedCount = state ? STEPS.filter(s => s.checks(state)).length : 0;
  const allDone        = completedCount === STEPS.length;

  const handleMarkComplete = async () => {
    if (!partnerId || !allDone) return;
    setMarkingDone(true); setError('');

    const { error: updateError } = await supabase
      .from('partners')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', partnerId);

    if (updateError) {
      setError('Something went wrong — please try again.');
      setMarkingDone(false);
      return;
    }

    router.push('/partner/brand');
  };

  if (loading) {
    return (
      <div style={{ padding: 40, color: 'var(--text-dim)', fontSize: 13 }}>
        Loading your onboarding checklist…
      </div>
    );
  }

  if (!state) {
    return (
      <div style={{ padding: 40, color: 'var(--text-dim)', fontSize: 13 }}>
        Partner account not found.
      </div>
    );
  }

  return (
    <div className="animate-fade-up" style={{ maxWidth: 580 }}>
      {/* FIX W-22: var(--font-heading) */}
      <h1 style={{
        fontFamily: 'var(--font-heading)', fontSize: 28,
        color: 'var(--text)', marginBottom: 6,
      }}>
        Set up your platform
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 32 }}>
        Complete these steps to launch your coaching platform.
        {subdomain && (
          <span style={{ display: 'block', marginTop: 4 }}>
            Your URL will be{' '}
            <strong style={{ color: 'var(--accent)' }}>{subdomain}.ascentorbi.com</strong>
          </span>
        )}
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Progress
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: completedCount === STEPS.length ? 'var(--success)' : 'var(--accent)' }}>
            {completedCount} / {STEPS.length}
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: completedCount === STEPS.length ? 'var(--success)' : 'var(--accent)',
            width: `${(completedCount / STEPS.length) * 100}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {STEPS.map((step, i) => {
          const done    = step.checks(state);
          const partial = step.partial(state);

          return (
            <div
              key={step.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '16px 18px', borderRadius: 12,
                background: done ? 'rgba(16,185,129,0.04)' : 'var(--bg-card)',
                border: `1px solid ${done ? 'rgba(16,185,129,0.2)' : partial ? 'rgba(232,160,32,0.2)' : 'var(--border)'}`,
                transition: 'all 0.2s',
              }}
            >
              {/* Step number / check */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: done ? 'var(--success)' : partial ? 'rgba(232,160,32,0.15)' : 'var(--bg-input)',
                color: done ? '#fff' : partial ? 'var(--accent)' : 'var(--text-dim)',
              }}>
                {done ? '✓' : i + 1}
              </div>

              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: 14, fontWeight: 600, marginBottom: 2,
                  color: done ? 'var(--success)' : 'var(--text)',
                }}>
                  {step.title}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  {partial ? step.partialMsg : step.description}
                </p>
              </div>

              {!done && (
                <Link
                  href={step.href}
                  style={{
                    padding: '7px 14px', borderRadius: 8, textDecoration: 'none',
                    fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                    background: partial ? 'var(--accent)' : 'var(--bg-input)',
                    color: partial ? '#000' : 'var(--text-dim)',
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
        padding: '20px 22px', borderRadius: 14,
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
          <p style={{
            fontSize: 12, color: '#EF4444',
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          }}>
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

      {/*
        FIX W-11: "Skip and go to admin panel" link REMOVED.
        It caused an infinite redirect because layout.tsx redirects
        any partner without onboarded_at back to this page.
        The "Mark as live" button above is the only valid exit.
      */}
    </div>
  );
}
