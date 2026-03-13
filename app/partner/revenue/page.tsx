// app/partner/revenue/page.tsx
//
// FIX WL-02: This file previously re-exported members/page.tsx by mistake.
//            The actual revenue component was in a file with an invalid name
//            ("[app--partner--revenue] page.tsx") that Next.js could not route.
//            That component has been moved here and updated to query the
//            "partners" table instead of the old "tenants" table.

export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Revenue' };

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function PartnerRevenuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Query partners table (not the old tenants table)
  const { data: partner } = await supabaseService
    .from('partners')
    .select('id, name, revenue_share_percent')
    .eq('owner_id', user.id)
    .single();

  // Fetch member subscription data via partner_members
  const { data: members } = partner
    ? await supabaseService
        .from('partner_members')
        .select('status, joined_at, profiles(subscription_plan, subscription_status, created_at)')
        .eq('partner_id', partner.id)
        .neq('status', 'removed')
    : { data: [] };

  const allMembers = members || [];

  // Flatten profiles for stats
  const profiles = allMembers
    .map((m: any) => m.profiles)
    .filter(Boolean)
    .flat();

  const active    = profiles.filter((p: any) => p.subscription_status === 'active');
  const trialing  = profiles.filter((p: any) => p.subscription_status === 'trialing');
  const cancelled = profiles.filter((p: any) => p.subscription_status === 'cancelled');
  const free      = profiles.filter((p: any) => !p.subscription_status || p.subscription_status === 'free');

  // Plan breakdown
  const planCounts: Record<string, number> = {};
  active.forEach((p: any) => {
    const plan = p.subscription_plan || 'unknown';
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  });

  // Monthly signups (last 6 months) based on partner_members.joined_at
  const now = new Date();
  const monthlySignups = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleDateString('en-GB', { month: 'short' });
    const count = allMembers.filter((m: any) => {
      const joined = new Date(m.joined_at || m.created_at || 0);
      return joined.getMonth() === d.getMonth() && joined.getFullYear() === d.getFullYear();
    }).length;
    return { label, count };
  });

  const maxSignups = Math.max(...monthlySignups.map((m) => m.count), 1);

  const statCard = (label: string, value: string | number, sub?: string, color = '#f8fafc') => (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 20px' }}>
      <div style={{ fontSize: '24px', fontWeight: 500, color, marginBottom: '2px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '3px', opacity: 0.6 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)', marginBottom: '4px' }}>Revenue</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          Subscription overview for {partner?.name || 'your platform'}.
          {partner && (
            <span style={{ marginLeft: 8, color: 'var(--accent)' }}>
              Your revenue share: {partner.revenue_share_percent}%
            </span>
          )}
        </p>
      </div>

      {/* Key stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '28px' }}>
        {statCard('Active subscribers', active.length, 'Paying members', 'var(--success)')}
        {statCard('Trialing', trialing.length, 'In free trial')}
        {statCard('Cancelled', cancelled.length, 'Churned', '#f87171')}
        {statCard('Free / no plan', free.length)}
      </div>

      {/* Plan breakdown */}
      {Object.keys(planCounts).length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active plan breakdown</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(planCounts).map(([plan, count]) => {
              const pct = active.length > 0 ? Math.round((count / active.length) * 100) : 0;
              return (
                <div key={plan}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text)', textTransform: 'capitalize' }}>{plan}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '2px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly signups chart */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly signups (last 6 months)</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '100px' }}>
          {monthlySignups.map(({ label, count }) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{count > 0 ? count : ''}</div>
              <div style={{
                width: '100%',
                height: `${Math.max((count / maxSignups) * 80, count > 0 ? 4 : 0)}px`,
                background: 'var(--accent)',
                borderRadius: '3px 3px 0 0',
                opacity: 0.8,
                minHeight: count > 0 ? '4px' : '0',
              }} />
              <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
