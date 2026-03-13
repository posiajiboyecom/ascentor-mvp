// app/partner/onboarding/page.tsx
export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Onboarding' };

export default async function PartnerOnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  const steps = [
    {
      num: 1,
      title: 'Set your brand',
      description: 'Upload your logo, set your platform name and colour palette.',
      href: '/partner/brand',
      done: !!(tenant?.logo_url && tenant?.name),
      action: 'Configure branding',
    },
    {
      num: 2,
      title: 'Configure your AI coach persona',
      description: 'Define how your AI coach speaks, what market it serves, and its coaching style.',
      href: '/partner/ai-persona',
      done: !!(tenant?.ai_persona_prompt && tenant.ai_persona_prompt.length > 50),
      action: 'Set AI persona',
    },
    {
      num: 3,
      title: 'Set your pricing',
      description: 'Connect your Paystack plan codes so your users can subscribe.',
      href: '/partner/pricing',
      done: !!(tenant?.paystack_plan_codes && Object.keys(tenant.paystack_plan_codes || {}).length > 0),
      action: 'Configure pricing',
    },
    {
      num: 4,
      title: 'Invite your first user',
      description: 'Share your platform URL or send a direct invite link.',
      href: '/partner/members',
      done: false, // checked dynamically via member count
      action: 'View members',
    },
    {
      num: 5,
      title: 'Go live',
      description: `Your platform is live at ${tenant?.subdomain ? `${tenant.subdomain}.ascentor.co` : 'yourname.ascentor.co'}`,
      href: tenant?.subdomain ? `https://${tenant.subdomain}.ascentor.co` : '#',
      done: !!(tenant?.is_active),
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

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
        <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(completedCount / steps.length) * 100}%`, background: '#14b8a6', borderRadius: '2px', transition: 'width 0.5s' }} />
        </div>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{completedCount}/{steps.length} done</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {steps.map((step) => (
          <div key={step.num} style={{
            background: step.done ? 'rgba(20,184,166,0.05)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${step.done ? 'rgba(20,184,166,0.2)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '10px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            {/* Step indicator */}
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: step.done ? '#14b8a6' : 'rgba(255,255,255,0.08)',
              color: step.done ? '#000' : 'rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: step.done ? '13px' : '12px', fontWeight: 600,
            }}>
              {step.done ? '✓' : step.num}
            </div>

            <div style={{ flex: 1 }}>
              <p style={{ color: step.done ? 'rgba(255,255,255,0.5)' : '#f8fafc', fontSize: '14px', fontWeight: 500, marginBottom: '2px', textDecoration: step.done ? 'line-through' : 'none' }}>
                {step.title}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>{step.description}</p>
            </div>

            {!step.done && (
              <Link
                href={step.href}
                target={step.external ? '_blank' : undefined}
                style={{
                  padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                  background: 'rgba(20,184,166,0.15)', color: '#14b8a6',
                  border: '1px solid rgba(20,184,166,0.25)', textDecoration: 'none',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {step.action}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
