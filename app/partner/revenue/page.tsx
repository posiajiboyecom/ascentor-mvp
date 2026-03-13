// app/partner/revenue/page.tsx
export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Revenue' };

export default async function PartnerRevenuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('owner_id', user.id)
    .single();

  // Fetch subscription breakdown
  const { data: subs } = tenant
    ? await supabase
        .from('profiles')
        .select('subscription_plan, subscription_status, created_at')
        .eq('tenant_id', tenant.id)
    : { data: [] };

  const allSubs = subs || [];

  // Calculate stats
  const active = allSubs.filter((s: any) => s.subscription_status === 'active');
  const trialing = allSubs.filter((s: any) => s.subscription_status === 'trialing');
  const cancelled = allSubs.filter((s: any) => s.subscription_status === 'cancelled');
  const free = allSubs.filter((s: any) => !s.subscription_status || s.subscription_status === 'free');

  // Plan breakdown
  const planCounts: Record<string, number> = {};
  active.forEach((s: any) => {
    const plan = s.subscription_plan || 'unknown';
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  });

  // Monthly signups (last 6 months)
  const now = new Date();
  const monthlySignups = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleDateString('en-GB', { month: 'short' });
    const count = allSubs.filter((s: any) => {
      const created = new Date(s.created_at);
      return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
    }).length;
    return { label, count };
  });

  const maxSignups = Math.max(...monthlySignups.map((m) => m.count), 1);

  const statCard = (label: string, value: string | number, sub?: string, color = '#f8fafc') => (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px 20px' }}>
      <div style={{ fontSize: '24px', fontWeight: 500, color, marginBottom: '2px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '3px' }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500, color: '#f8fafc', marginBottom: '4px' }}>Revenue</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
          Subscription overview for {tenant?.name || 'your platform'}.
        </p>
      </div>

      {/* Key stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '28px' }}>
        {statCard('Active subscribers', active.length, 'Paying users', '#4ade80')}
        {statCard('Trialing', trialing.length, 'In free trial')}
        {statCard('Cancelled', cancelled.length, 'Churned users', '#f87171')}
        {statCard('Free / no plan', free.length)}
      </div>

      {/* Plan breakdown */}
      {Object.keys(planCounts).length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active plan breakdown</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(planCounts).map(([plan, count]) => {
              const pct = active.length > 0 ? Math.round((count / active.length) * 100) : 0;
              return (
                <div key={plan}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '13px', color: '#f8fafc', textTransform: 'capitalize' }}>{plan}</span>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#14b8a6', borderRadius: '3px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly signups chart */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New signups — last 6 months</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '80px' }}>
          {monthlySignups.map(({ label, count }) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{count || ''}</span>
              <div style={{
                width: '100%',
                height: `${Math.max((count / maxSignups) * 56, count > 0 ? 4 : 0)}px`,
                background: count > 0 ? '#14b8a6' : 'rgba(255,255,255,0.06)',
                borderRadius: '4px 4px 0 0',
                minHeight: '4px',
              }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Note on revenue data */}
      <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '10px', padding: '14px 16px' }}>
        <p style={{ fontSize: '12px', color: '#fbbf24', marginBottom: '3px', fontWeight: 500 }}>Actual revenue figures</p>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          Transaction amounts and payouts are managed directly in your Paystack dashboard.
          {' '}<a href="https://dashboard.paystack.com" target="_blank" rel="noopener noreferrer" style={{ color: '#14b8a6' }}>Open Paystack ↗</a>
        </p>
      </div>
    </div>
  );
}
