// app/p/[subdomain]/admin/onboarding/page.tsx
//
// Subdomain-specific onboarding page.
// Uses /admin/... hrefs instead of /partner/... hrefs.
// Cannot re-export from app/partner/onboarding/page because those
// links resolve to demo.ascentorbi.com/partner/... → 404.
// The proxy rewrites /admin/brand → /p/demo/admin/brand transparently.

export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { getPartnerContext } from '@/lib/getPartnerContext';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Onboarding' };

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function SubdomainOnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Use service role so we get ai_config + plan_overrides
  const { data: tenant } = await supabaseService
    .from('partners')
    .select('id, name, subdomain, custom_domain, status, brand, ai_config, plan_overrides, onboarded_at')
    .eq('owner_id', user.id)
    .single();

  const brand        = (tenant as any)?.brand        || {};
  const aiConfig     = (tenant as any)?.ai_config    || {};
  const planOverrides = (tenant as any)?.plan_overrides || {};

  // Member count for step 4 completion check
  let hasMember = false;
  if (tenant?.id) {
    const { count } = await supabaseService
      .from('partner_members')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', tenant.id)
      .eq('status', 'active');
    hasMember = (count || 0) > 0;
  }

  // Live URL — prefer custom domain, fall back to subdomain
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
      href: '/admin/brand',         // ← /admin/... not /partner/...
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
    },
    {
      num: 3,
      title: 'Set your pricing',
      description: 'Connect your Paystack plan codes so your users can subscribe.',
      href: '/admin/pricing',
      done: !!(planOverrides.monthly_plan_code || planOverrides.annual_plan_code),
      action: 'Configure pricing',
    },
    {
      num: 4,
      title: 'Invite your first user',
      description: 'Share your platform URL or send a direct invite link.',
      href: '/admin/members',
      done: hasMember,
      action: 'View members',
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

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div style={{ maxWidth: '600px' }}>
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
            background: '#14b8a6', borderRadius: '2px', transition: 'width 0.5s',
          }} />
        </div>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
          {completedCount}/{steps.length} done
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {steps.map((step) => (
          <div key={step.num} style={{
            background: step.done ? 'rgba(20,184,166,0.05)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${step.done ? 'rgba(20,184,166,0.2)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '10px', padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            {/* Step number / tick */}
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: step.done ? '#14b8a6' : 'rgba(255,255,255,0.08)',
              color: step.done ? '#000' : 'rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: step.done ? '13px' : '12px', fontWeight: 600,
            }}>
              {step.done ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : step.num}
            </div>

            <div style={{ flex: 1 }}>
              <p style={{
                color: step.done ? 'rgba(255,255,255,0.45)' : '#f8fafc',
                fontSize: '14px', fontWeight: 500, marginBottom: '2px',
                textDecoration: step.done ? 'line-through' : 'none',
              }}>
                {step.title}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
                {step.description}
              </p>
            </div>

            <Link
              href={step.href}
              target={step.external ? '_blank' : undefined}
              rel={step.external ? 'noopener noreferrer' : undefined}
              style={{
                padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                background: step.done ? 'rgba(255,255,255,0.05)' : 'rgba(20,184,166,0.15)',
                color: step.done ? 'rgba(255,255,255,0.3)' : '#14b8a6',
                border: `1px solid ${step.done ? 'rgba(255,255,255,0.08)' : 'rgba(20,184,166,0.25)'}`,
                textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                pointerEvents: step.done && !step.external ? 'none' : 'auto',
              }}
            >
              {step.done && !step.external ? 'Done' : step.action}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
