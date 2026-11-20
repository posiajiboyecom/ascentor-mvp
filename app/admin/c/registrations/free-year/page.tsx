import Link from 'next/link';
import { requireArea } from '@/lib/admin/access';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Grant } from '@/lib/summit-access';
import { AddEmails, RemoveEmail } from './FreeYearControls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Summit free year' };

const cell = { padding: '8px 10px', borderBottom: '1px solid #e8e6e1', textAlign: 'left' as const, whiteSpace: 'nowrap' as const };
const SOURCE: Record<string, string> = { emailed: 'Emailed us', checked_in: 'Scanned in', admin: 'Added by admin' };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }) : '');

export default async function Page() {
  const staff = await requireArea('registrations', 'view');
  const level = staff.uiLevel('registrations');
  const canEdit = level === 'edit' || level === 'full';
  const { data, error } = await supabaseAdmin.from('summit_access_grants').select('*').is('revoked_at', null).order('claimed_at', { ascending: false, nullsFirst: false }).order('added_at', { ascending: false }).limit(2000);
  const rows = (data ?? []) as Grant[];
  const claimed = rows.filter((r) => r.claimed_user_id).length;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 64px' }}>
      <Link href="/admin/c/registrations" style={{ fontSize: 14 }}>← Registrations</Link>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '12px 0 4px' }}>Summit free year</h1>
      <p style={{ opacity: 0.75, margin: '0 0 20px' }}>
        Attendees on this list get Ascentor Builder free for 12 months. They claim it at <b>joinascentor.com/summit-access</b>: email, 6-digit code, then a password.
        {' '}{rows.length} on the list · {claimed} claimed · {rows.length - claimed} not yet.
      </p>
      {error ? <p role="alert">Could not load the list: {error.message}</p> : (<>
        {canEdit && <AddEmails />}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', display: 'table' }}>
            <thead><tr>{['Email', 'Name', 'How they got here', 'Status', ''].map((h) => <th key={h} style={{ ...cell, fontSize: 12, textTransform: 'uppercase', opacity: 0.7 }}>{h}</th>)}</tr></thead>
            <tbody>{rows.length === 0 ? <tr><td style={cell} colSpan={5}>Nobody on the list yet.</td></tr> : rows.map((r) => (
              <tr key={r.email}>
                <td style={{ ...cell, fontWeight: 600 }}>{r.email}</td>
                <td style={cell}>{r.name ?? ''}</td>
                <td style={cell}>{SOURCE[r.source] ?? r.source}{r.note ? <span style={{ opacity: 0.65, fontSize: 12 }}> · {r.note}</span> : null}</td>
                <td style={cell}>{r.claimed_at
                  ? <span style={{ color: '#1E6B34', fontWeight: 600 }}>Claimed {day(r.claimed_at)}{r.access_until ? ` · free until ${day(r.access_until)}` : ''}</span>
                  : <span style={{ opacity: 0.7 }}>Not claimed yet</span>}</td>
                <td style={cell}>{canEdit && !r.claimed_user_id ? <RemoveEmail email={r.email} /> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </>)}
    </div>
  );
}
