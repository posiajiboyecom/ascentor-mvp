import '@/styles/rx.css';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BackLink } from '@/components/rx/ui';

export const dynamic = 'force-dynamic';

export default async function ChatAccessLogPage() {
  try { await requireAdmin(); } catch { return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">Chats are available to admins only.</p></div></div>; }
  const { data } = await supabaseAdmin.from('chat_access_log').select('id, admin_id, action, scope, ref_id, format, detail, created_at').order('created_at', { ascending: false }).limit(200);
  const rows = (data ?? []) as { id: string; admin_id: string; action: string; scope: string; ref_id: string | null; format: string | null; detail: Record<string, unknown>; created_at: string }[];
  const ids = [...new Set(rows.map((r) => r.admin_id))];
  const { data: dir } = ids.length ? await supabaseAdmin.from('member_directory').select('id, full_name').in('id', ids) : { data: [] };
  const nm = new Map(((dir ?? []) as { id: string; full_name: string | null }[]).map((d) => [d.id, d.full_name ?? 'Admin']));

  return (
    <div className="rx" style={{ padding: 16 }}>
      <BackLink href="/admin/chats">Chats</BackLink>
      <h1 className="rx-title" style={{ marginTop: 8 }}>Access log</h1><span className="rx-rule" />
      <div className="rx-card" style={{ overflowX: 'auto' }}>
        <table className="rx-tbl"><thead><tr><th>When (UTC)</th><th>Admin</th><th>Action</th><th>Chat type</th><th>Format</th><th>Messages</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}><td style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 16)}</td><td>{nm.get(r.admin_id)}</td><td>{r.action === 'export' ? 'Downloaded' : 'Viewed'}</td><td>{r.scope}</td><td>{r.format ?? '-'}</td><td>{String(r.detail?.messages ?? '-')}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="rx-sm">Nothing recorded yet.</td></tr>}
          </tbody></table>
      </div>
    </div>
  );
}
