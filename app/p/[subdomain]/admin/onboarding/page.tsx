// app/p/[subdomain]/admin/onboarding/page.tsx
//
// Subdomain-specific onboarding page.
// Uses /admin/... hrefs instead of /partner/... hrefs.
// Shows current plan tier and includes subscription awareness.

export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getTierConfig, resolveTier } from '@/lib/partnerTier';

export const metadata: Metadata = { title: 'Onboarding' };

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function SubdomainOnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenant } = await supabaseService
    .from('partners')
    .select('id, name, subdomain, custom_domain, status, brand, ai_config, plan_overrides, plan_tier, onboarded_at')
    .eq('owner_id', user.id)
    .single();

  const brand        = (tenant as any)?.brand        || {};
  const aiConfig     = (tenant as any)?.ai_config    || {};
  const planOverrides = (tenant as any)?.plan_overrides || {};
  const tier         = resolveTier((tenant as any)?.plan_tier);
  const tierCfg      = getTierConfig(tier);

  // Member count for step 4
  let hasMember = false;
  if (tenant?.id) {
    const { count } = await supabaseService
      .from('partner_members')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', tenant.id)
      .eq('status', 'active');
    hasMember = (count || 0) > 0;
  }

  // Active subscription
  const { data: sub } = await supabaseService
    .from('partner_subscriptions')
    .select('plan_tier, billing_cycle, current_period_end, status')
    .eq('partner_id', tenant?.id || '')
    .eq('status', 'active')
    .maybeSingle();

  const liveUrl = tenant?.custom_domain
    ? `https://${tenant.custom_domain}`
    : tenant?.subdomain
      ? `https://${tenant.subdomain}.ascentorbi.com`
      : null;

  const steps = [
    {
      num: 1,
      title: 'Set your brand',
      description: 'Upload your logo, set your platform name and colour palette.',
      href: '/admin/brand',
      done: !!(brand.logo_url && tenant?.name),
      action: 'Configure branding',
    },
    {
      num: 2,
      title: 'Configure your AI coach persona',
      description: 'Define how your AI coach speaks, what market it serves, and its coaching style.',
      href: '/admin/ai/persona',
      done: !!(aiConfig.ai_persona_prompt && (aiConfig.ai_persona_prompt as string).length > 50),
      action: 'Set AI persona',
      locked: !tierCfg.features.customAiPersona,
      lockedReason: 'Upgrade to Growth to customise your AI persona',
    },
    {
      num: 3,
      title: 'Set your pricing',
      description: 'Connect your Paystack plan codes so your members can subscribe.',
      href: '/admin/pricing',
      done: !!(planOverrides.monthly_plan_code || planOverrides.annual_plan_code),
      action: 'Configure pricing',
    },
    {
      num: 4,
      title: 'Invite your first member',
      description: 'Share your platform URL or send a direct invite link.',
      href: '/admin/members',
      done: hasMember,
      action: 'Invite members',
    },
    {
      num: 5,
      title: 'Go live',
      description: liveUrl
        ? `Your platform is live at ${liveUrl.replace('https://', '')}`
        : 'Your platform will be live once approved.',
      href: liveUrl || '#',
      done: tenant?.status === 'active',
      action: 'View live site ↗',
      external: true,
    },
  ];

  const completedCount = steps.filter(s => s.done && !s.locked).length;
  const TEAL = '#14b8a6';

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Plan tier banner */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px', padding: '14px 18px', marginBottom: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', textTransform: 'uppercase' as const,
            background: tier === 'pro' ? 'rgba(139,92,246,0.15)' : tier === 'growth' ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.08)',
            color:      tier === 'pro' ? '#8B5CF6'               : tier === 'growth' ? TEAL                    : 'rgba(255,255,255,0.4)',
            border:     `1px solid ${tier === 'pro' ? 'rgba(139,92,246,0.3)' : tier === 'growth' ? 'rgba(20,184,166,0.3)' : 'rgba(255,255,255,0.15)'}`,
          }}>
            {tierCfg.name} plan
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            ₦{tierCfg.monthlyNgn.toLocaleString('en-NG')}/month · {tierCfg.revenueSharePct}% revenue share
          </span>
        </div>
        <a href="/admin/subscription" style={{
          fontSize: '11px', color: '#E8A020', textDecoration: 'none',
          padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(232,160,32,0.25)',
          background: 'rgba(232,160,32,0.06)',
        }}>
          {tier === 'pro' ? 'Manage plan' : 'Upgrade ↗'}
        </a>
      </div>

      <h1 style={{ fontSize: '20px', fontWeight: 500, color: '#f8fafc', marginBottom: '6px' }}>Onboarding</h1>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
        Complete these steps to launch your platform.
      </p>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
        <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(completedCount / steps.length) * 100}%`,
            background: TEAL, borderRadius: '2px', transition: 'width 0.5s',
          }} />
        </div>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
          {completedCount}/{steps.length} done
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {steps.map((step) => (
          <div key={step.num} style={{
            background: step.done ? 'rgba(20,184,166,0.05)' : step.locked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${step.done ? 'rgba(20,184,166,0.2)' : step.locked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '10px', padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            {/* Step indicator */}
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: step.done ? TEAL : step.locked ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
              color: step.done ? '#000' : 'rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 600,
            }}>
              {step.done ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : step.locked ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : step.num}
            </div>

            <div style={{ flex: 1 }}>
              <p style={{
                color: step.done ? 'rgba(255,255,255,0.45)' : step.locked ? 'rgba(255,255,255,0.25)' : '#f8fafc',
                fontSize: '14px', fontWeight: 500, marginBottom: '2px',
                textDecoration: step.done ? 'line-through' : 'none',
              }}>
                {step.title}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
                {step.locked ? step.lockedReason : step.description}
              </p>
            </div>

            <Link
              href={step.locked ? '/admin/subscription' : step.href}
              target={step.external ? '_blank' : undefined}
              rel={step.external ? 'noopener noreferrer' : undefined}
              style={{
                padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                background: step.done
                  ? 'rgba(255,255,255,0.05)'
                  : step.locked
                    ? 'rgba(232,160,32,0.08)'
                    : `rgba(20,184,166,0.15)`,
                color: step.done
                  ? 'rgba(255,255,255,0.3)'
                  : step.locked
                    ? '#E8A020'
                    : TEAL,
                border: `1px solid ${step.done ? 'rgba(255,255,255,0.08)' : step.locked ? 'rgba(232,160,32,0.2)' : 'rgba(20,184,166,0.25)'}`,
                textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                pointerEvents: step.done && !step.external ? 'none' : 'auto',
              }}
            >
              {step.done && !step.external ? 'Done' : step.locked ? 'Upgrade →' : step.action}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

