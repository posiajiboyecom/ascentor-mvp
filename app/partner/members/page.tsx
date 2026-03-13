// app/partner/members/page.tsx
export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Members' };

export default async function PartnerMembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  const { data: members, count } = tenant
    ? await supabase
        .from('profiles')
        .select('id, full_name, email, subscription_plan, subscription_status, created_at', { count: 'exact' })
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [], count: 0 };

  const statusColor = (status: string) => {
    if (status === 'active') return { bg: 'rgba(74,222,128,0.12)', text: '#4ade80', border: 'rgba(74,222,128,0.2)' };
    if (status === 'trialing') return { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.2)' };
    return { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.1)' };
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500, color: '#f8fafc', marginBottom: '4px' }}>Members</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
          {count ?? 0} total users on your platform.
        </p>
      </div>

      {!members || members.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '10px', padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No members yet</p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', marginTop: '4px' }}>Share your platform link to onboard your first users.</p>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Name', 'Plan', 'Status', 'Joined'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => {
                const c = statusColor(m.subscription_status);
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 16px', color: '#f8fafc' }}>
                      <div>{m.full_name || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>{m.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)' }}>{m.subscription_plan || 'free'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                        {m.subscription_status || 'inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                      {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
