import Link from 'next/link';
import '@/styles/rx.css';
import { Download } from 'lucide-react';
import { requireAdmin } from '@/lib/rx/admin';
import { getTranscripts, logAccess, type ChatScope } from '@/lib/rx/chats';
import { Aside, BackLink } from '@/components/rx/ui';

export const dynamic = 'force-dynamic';

const SCOPES: ChatScope[] = ['circle', 'group', 'dm', 'sage', 'member'];
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ChatViewPage({ searchParams }: { searchParams: Promise<{ scope?: string; id?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  let admin;
  try { admin = await requireAdmin(); } catch { return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">Chats are available to admins only.</p></div></div>; }

  const scope = sp.scope as ChatScope;
  const id = sp.id ?? '';
  const from = sp.from && DATE.test(sp.from) ? sp.from : undefined;
  const to = sp.to && DATE.test(sp.to) ? sp.to : undefined;
  if (!SCOPES.includes(scope) || !UUID.test(id)) return <div className="rx rx-page"><BackLink href="/admin/chats">Chats</BackLink><div className="rx-card rx-empty"><p className="rx-p">Choose a chat from the list.</p></div></div>;

  const transcripts = await getTranscripts(scope, id, from, to);
  const total = transcripts.reduce((n, t) => n + t.lines.length, 0);
  await logAccess(admin.userId, 'view', scope, id, undefined, { from: from ?? null, to: to ?? null, messages: total });

  const qs = (fmt: string) => `/api/admin/chats/export?scope=${scope}&id=${id}&format=${fmt}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`;

  return (
    <div className="rx" style={{ padding: 16 }}>
      <BackLink href={`/admin/chats?tab=${scope}`}>Chats</BackLink>
      <h1 className="rx-title" style={{ marginTop: 8 }}>{transcripts[0]?.title ?? 'Chat'}</h1>
      <span className="rx-rule" />
      <div className="rx-two">
        <div className="rx-stack">
          {transcripts.length === 0 && <div className="rx-card rx-empty"><p className="rx-p">That chat was not found.</p></div>}
          {transcripts.map((t) => (
            <div key={`${t.scope}-${t.id}`} className="rx-card rx-stack-sm">
              <div className="rx-between"><p className="rx-h3">{t.title}</p><span className="rx-sm">{t.subtitle} · {t.lines.length} messages</span></div>
              {t.truncated && <p className="rx-sm" style={{ color: 'var(--rx-danger)' }}>Showing the first 5,000 messages. Narrow the date range to see the rest.</p>}
              <div className="rx-stack-sm" style={{ maxHeight: 560, overflowY: 'auto', paddingRight: 4 }}>
                {t.lines.map((l, i) => (
                  <div key={i}><p className="rx-sm"><b>{l.who}</b> · {new Date(l.at).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</p><p className="rx-p" style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>{l.text}</p></div>
                ))}
                {t.lines.length === 0 && <p className="rx-sm">No messages in this range.</p>}
              </div>
            </div>
          ))}
        </div>
        <Aside>
          <p className="rx-label">Download</p>
          <div className="rx-row">
            <a href={qs('pdf')} className="rx-btn primary" download><Download aria-hidden style={{ width: 16, height: 16 }} />PDF</a>
            <a href={qs('txt')} className="rx-btn secondary" download><Download aria-hidden style={{ width: 16, height: 16 }} />Text file</a>
          </div>
          <p className="rx-label">Date range</p>
          <form method="get" className="rx-stack-sm">
            <input type="hidden" name="scope" value={scope} /><input type="hidden" name="id" value={id} />
            <div className="rx-fld"><label htmlFor="f">From</label><input id="f" name="from" type="date" className="rx-in" defaultValue={from} /></div>
            <div className="rx-fld"><label htmlFor="t">To</label><input id="t" name="to" type="date" className="rx-in" defaultValue={to} /></div>
            <div className="rx-row"><button type="submit" className="rx-btn secondary">Apply</button>{(from || to) && <Link href={`/admin/chats/view?scope=${scope}&id=${id}`} className="rx-link muted">Clear</Link>}</div>
          </form>
          <p className="rx-sm">Downloads include the range you apply here. Opening and downloading are recorded in the access log.</p>
        </Aside>
      </div>
    </div>
  );
}
