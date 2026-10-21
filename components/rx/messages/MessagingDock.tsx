'use client';

// The desktop dock: a "Messaging" list panel pinned to the bottom right, and docked chat windows that
// can be minimised or expanded to the full Messaging page. Desktop only (CSS hides it below 1024px),
// hidden on /messages itself, and its open/minimised state is remembered for the browser tab.

import Link from 'next/link';
import '@/styles/rx-messaging.css'; // the dock is also mounted outside the (app) layout (for example /checkout)
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronUp, Maximize2, Minus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dockConvo, dockThreads, type DockConvo } from '@/app/(app)/messages/actions';
import { DmChat } from '@/components/rx/messages/MessagesClient';
import { OnlineDot, useOnline } from '@/components/rx/messages/Presence';
import { Avatar } from '@/components/rx/ui';
import type { ThreadItem } from '@/lib/rx/messages';

const KEY = 'rxm-dock';
interface DockState { open: boolean; chat: string | null; min: boolean }

function load(): DockState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) { const v = JSON.parse(raw) as Partial<DockState>; return { open: !!v.open, chat: typeof v.chat === 'string' ? v.chat : null, min: !!v.min }; }
  } catch { /* storage blocked */ }
  return { open: false, chat: null, min: false };
}

export default function MessagingDock({ meId, meName, meAvatarUrl, initialUnread }: { meId: string; meName: string; meAvatarUrl: string | null; initialUnread: number }) {
  const pathname = usePathname();
  const online = useOnline();
  const [st, setSt] = useState<DockState>({ open: false, chat: null, min: false });
  const [ready, setReady] = useState(false);
  const [threads, setThreads] = useState<ThreadItem[] | null>(null);
  const [convo, setConvo] = useState<DockConvo | null>(null);
  const [convoError, setConvoError] = useState('');
  const seq = useRef(0);

  useEffect(() => { setSt(load()); setReady(true); }, []);
  const update = useCallback((patch: Partial<DockState>) => {
    setSt((cur) => {
      const next = { ...cur, ...patch };
      try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const hidden = !pathname || pathname === '/messages' || pathname.startsWith('/messages/');

  // The list is loaded when the panel is open, and refreshed on new messages and every half minute.
  const refreshList = useCallback(async () => { try { setThreads(await dockThreads()); } catch { /* keep the old list */ } }, []);
  useEffect(() => {
    if (hidden || !ready || !st.open) return;
    void refreshList();
    const timer = setInterval(() => { void refreshList(); }, 30000);
    let cleanup = () => {};
    try {
      const sb = createClient();
      let t: ReturnType<typeof setTimeout> | null = null;
      const ch = sb.channel('rxm-dock-list')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages' }, () => { if (t) clearTimeout(t); t = setTimeout(() => { void refreshList(); }, 800); })
        .subscribe();
      cleanup = () => { if (t) clearTimeout(t); void sb.removeChannel(ch); };
    } catch { /* polling covers it */ }
    return () => { clearInterval(timer); cleanup(); };
  }, [hidden, ready, st.open, refreshList]);

  // The docked chat window.
  useEffect(() => {
    if (hidden || !ready || !st.chat) { setConvo(null); setConvoError(''); return; }
    const n = ++seq.current;
    setConvo(null); setConvoError('');
    void dockConvo(st.chat).then((r) => {
      if (n !== seq.current) return;
      if (r.ok) setConvo(r.convo); else { setConvoError(r.error); }
    }).catch(() => { if (n === seq.current) setConvoError('We couldn’t open that conversation.'); });
  }, [hidden, ready, st.chat]);

  if (hidden || !ready) return null;

  const unreadN = threads ? threads.filter((t) => t.unread).length : initialUnread;
  const openChat = (t: ThreadItem) => {
    setThreads((cur) => cur && cur.map((x) => (x.key === t.key ? { ...x, unread: false } : x)));
    update({ chat: t.key, min: false });
  };

  return (
    <div className="rxm-dock rx" aria-label="Messaging dock">
      {st.chat && (
        <div className={`rxm-dpanel rxm-dwin${st.min ? ' min' : ''}`} role="dialog" aria-label={convo ? `Chat with ${convo.name}` : 'Chat'}>
          <div className="rxm-dh">
            <span className="rxm-avw">
              <Avatar name={convo?.name ?? ''} url={convo?.avatarUrl ?? null} seed={convo?.otherId ?? st.chat} />
              {convo && online.has(convo.otherId) && <OnlineDot />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="num" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{convo?.name ?? 'Loading…'}</p>
              {convo && online.has(convo.otherId) && <p className="rx-sm" style={{ fontSize: 12 }}>Active now</p>}
            </div>
            <button type="button" className="rx-ib" aria-label={st.min ? 'Expand chat' : 'Minimise chat'} onClick={() => update({ min: !st.min })}>{st.min ? <ChevronUp aria-hidden /> : <Minus aria-hidden />}</button>
            <Link href={`/messages?t=${st.chat}`} className="rx-ib" aria-label="Open in Messaging" onClick={() => update({ chat: null })}><Maximize2 aria-hidden /></Link>
            <button type="button" className="rx-ib" aria-label="Close chat" onClick={() => update({ chat: null })}><X aria-hidden /></button>
          </div>
          {!st.min && (
            <div className="rxm-dbody">
              {convo ? (
                <DmChat
                  key={convo.id} threadId={convo.id} meId={meId} meName={meName} meAvatarUrl={meAvatarUrl}
                  initial={convo.msgs} canSend={convo.canSend} peerReadAt={convo.seenAt} composer="mini"
                  notice={<p className="rx-sm">You can’t reply to this message. Accept or decline it under Requests.</p>}
                />
              ) : convoError ? (
                <p className="rx-sm" role="alert" style={{ padding: 16 }}>{convoError}</p>
              ) : <p className="rx-sm" style={{ padding: 16 }}>Opening…</p>}
            </div>
          )}
        </div>
      )}

      <div className={`rxm-dpanel rxm-dlist${st.open ? ' open' : ''}`}>
        <button type="button" className="rxm-dh" aria-expanded={st.open} onClick={() => update({ open: !st.open })}>
          <span className="rxm-avw"><Avatar name={meName} url={meAvatarUrl} seed={meId} /><OnlineDot /></span>
          <span className="num" style={{ flex: 1 }}>Messaging</span>
          {unreadN > 0 && <span className="rxm-dcount" aria-label={`${unreadN} unread`}>{unreadN}</span>}
          {st.open ? <ChevronDown aria-hidden width={20} height={20} /> : <ChevronUp aria-hidden width={20} height={20} />}
        </button>
        {st.open && (
          <div className="rxm-dbody">
            {threads === null && <p className="rx-sm" style={{ padding: 16 }}>Loading…</p>}
            {threads && threads.length === 0 && <p className="rx-sm" style={{ padding: 16 }}>No messages yet.</p>}
            {threads?.map((t) => (
              <button key={t.key} type="button" className={`rxm-thr${st.chat === t.key ? ' on' : ''}${t.unread ? ' unread' : ''}`} onClick={() => openChat(t)}>
                <span className="rxm-avw"><Avatar name={t.name} url={t.avatarUrl} seed={t.seed} />{t.otherId && online.has(t.otherId) && <OnlineDot />}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="sb"><span className="tn" style={{ fontSize: 14 }}>{t.name}</span><span className="sm" style={{ fontSize: 12, flex: 'none' }}>{t.time}</span></span>
                  <span className="sb"><span className="tl" style={{ fontSize: 13 }}>{t.last}</span>{t.unread && <span className="rxm-udot" role="img" aria-label="Unread" />}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
