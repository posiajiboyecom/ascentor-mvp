import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Aside, Title } from '@/components/rx/ui';
import { LANGUAGES } from '@/lib/rx/constants';
import { audienceLabel, parseAudience } from '@/lib/rx/audience';
import { listBroadcasts } from '@/lib/rx/broadcasts';
import BroadcastsAdmin, { type HistoryRow } from '@/components/rx/admin/BroadcastsAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function BroadcastsPage() {
  try { await requireAdmin(); } catch { return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">Broadcasts are sent by admins.</p></div></div>; }

  const [history, { data: circles }] = await Promise.all([
    listBroadcasts(),
    supabaseAdmin.from('circles').select('id, name, number, interest').eq('is_demo', false).order('number'),
  ]);
  const circleRows = ((circles ?? []) as { id: string; name: string; number: number; interest: string | null }[]).map((c) => ({ id: c.id, label: c.interest ? `${c.interest} · Circle ${c.number}` : `${c.name} · Circle ${c.number}` }));
  const nameOf = new Map(circleRows.map((c) => [c.id, c.label]));

  const rows: HistoryRow[] = history.map((b) => {
    const a = parseAudience(b.audience);
    return {
      id: b.id, title: b.title, channel: b.channel, status: b.status, pinned: b.pin_card && (!b.pin_until || new Date(b.pin_until) > new Date()),
      audience: a ? audienceLabel(a, a.kind === 'circle' ? nameOf.get(a.value) : undefined) : 'Unknown',
      total: b.total, inApp: b.in_app_sent, emailed: b.emailed, failed: b.email_failed, when: new Date(b.created_at).toISOString(),
    };
  });

  return (
    <ToastProvider>
      <div className="rx rx-admin-desktop" style={{ padding: 4 }}>
        <p className="rx-sm">Community</p>
        <Title>Broadcasts</Title>
        <div className="rx-two">
          <BroadcastsAdmin circles={circleRows} languages={[...LANGUAGES]} history={rows} />
          <Aside>
            <p className="rx-label">How it works</p>
            <p className="rx-p">Write one message and send it in the app, by email, or both. Send it to everyone, or to one stage, city, language or Circle.</p>
            <p className="rx-sm">In the app, it arrives in each member’s bell, and as a push on phones where they turned push on. By email, it arrives from the Ascentor mailbox.</p>
            <p className="rx-sm">Members who muted announcements are not pushed or emailed. Members who turned off announcement emails in Settings are not emailed. Demo accounts are never included.</p>
            <p className="rx-sm">“Show as a card” also pins the message in the sidebar and the phone menu until the date you choose.</p>
            <p className="rx-sm">Send yourself a test first. It arrives exactly as members get it.</p>
          </Aside>
        </div>
      </div>
    </ToastProvider>
  );
}
