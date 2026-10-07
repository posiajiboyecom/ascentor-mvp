'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Ban, BellOff, Flag } from 'lucide-react';
import ChatThread from '@/components/rx/ChatThread';
import type { ChatMsg } from '@/lib/rx/chat-types';
import { answerRequest, blockMember, openThread, pollDm, reportThread, sendDm } from '@/app/(app)/messages/actions';
import { useToast } from '@/components/rx/Toast';

export function ReachOutButton({ userId, name, label = 'Reach out personally', secondary = false }: { userId: string; name: string; label?: string; secondary?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <>
      <button type="button" className={`rx-btn ${secondary ? 'secondary' : 'primary'}`} disabled={pending} aria-label={`${label}: ${name}`} onClick={() => start(async () => {
        const r = await openThread(userId);
        if (!r.ok) { setError(r.error); return; }
        router.push(`/messages?t=${r.threadId}`);
      })}>{pending ? 'Opening…' : label}</button>
      {error && <span className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</span>}
    </>
  );
}

export function RequestActions({ threadId, primary }: { threadId: string; primary: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const answer = (accept: boolean) => start(async () => {
    const r = await answerRequest(threadId, accept);
    if (!r.ok) { setError(r.error); return; }
    toast(accept ? 'Request accepted.' : 'Declined. They won’t be told.');
    if (accept) router.push(`/messages?t=${threadId}`); else router.refresh();
  });
  return (
    <>
      <button type="button" className={`rx-btn ${primary ? 'primary' : 'secondary'}`} disabled={pending} onClick={() => answer(true)}>Accept</button>
      <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => answer(false)}>Decline</button>
      {error && <span className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</span>}
    </>
  );
}

export function ThreadActions({ threadId }: { threadId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  return (
    <>
      <button type="button" className="rx-ib" aria-label="Mute" onClick={() => toast('Conversation muted.')}><BellOff aria-hidden /></button>
      <button type="button" className="rx-ib" aria-label="Block" onClick={() => start(async () => {
        const r = await blockMember(threadId);
        toast(r.ok ? 'Blocked. They can’t message you.' : r.error);
        if (r.ok) router.push('/messages');
      })}><Ban aria-hidden /></button>
      <button type="button" className="rx-ib" aria-label="Report" onClick={() => start(async () => {
        const r = await reportThread('dm', threadId);
        toast(r.ok ? 'Reported. Our safety team will review it.' : r.error);
      })}><Flag aria-hidden /></button>
    </>
  );
}

export function DmChat({ threadId, meId, initial, canSend, notice }: { threadId: string; meId: string; initial: ChatMsg[]; canSend: boolean; notice?: React.ReactNode }) {
  return (
    <ChatThread
      initial={initial} meId={meId} canSend={canSend} notice={notice}
      send={(b) => sendDm(threadId, b)} poll={(a) => pollDm(threadId, a)}
      realtime={{ table: 'dm_messages', column: 'thread_id', value: threadId }}
      placeholder="Write a message"
    />
  );
}

export function ProfileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="rx-link">{children}<ArrowRight aria-hidden /></Link>;
}
