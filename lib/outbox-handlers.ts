'use client';

// How each outbox kind is sent. Registered once by the member shell.

import { registerHandler, type HandlerResult, type OutboxItem } from '@/lib/outbox';

export interface CheckinPayload { content: string; dimensionTag: string | null }
export interface CircleMessagePayload { circleId: string; body: string }
export interface DmMessagePayload { threadId: string; body: string }

/** The check-in route allows one per member per week. A repeat comes back 409, which means "already there". */
export async function sendCheckin(p: CheckinPayload): Promise<HandlerResult> {
  let res: Response;
  try {
    res = await fetch('/api/community/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: p.content, dimensionTag: p.dimensionTag }),
    });
  } catch { return { result: 'retry' }; }
  if (res.ok) { const j = await res.json().catch(() => ({})); return { result: 'sent', data: (j as { message?: unknown }).message }; }
  if (res.status === 409) return { result: 'sent' };
  if (res.status === 401 || res.status === 408 || res.status === 429 || res.status >= 500) return { result: 'retry' };
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  return { result: 'drop', error: j.error };
}

let registered = false;
export function registerOutboxHandlers(): void {
  if (registered) return;
  registered = true;

  registerHandler('checkin', (item: OutboxItem) => sendCheckin(item.payload as CheckinPayload));

  // Chat kinds only run when switched on in lib/outbox.ts (they need the client_id column).
  registerHandler('circle_message', async (item) => {
    const p = item.payload as CircleMessagePayload;
    const { sendCircleMessage } = await import('@/app/(app)/circle/actions');
    const r = await sendCircleMessage(p.circleId, p.body, item.id);
    return r.ok ? { result: 'sent', data: r.message } : { result: 'drop', error: r.error };
  });
  registerHandler('dm_message', async (item) => {
    const p = item.payload as DmMessagePayload;
    const { sendDm } = await import('@/app/(app)/messages/actions');
    const r = await sendDm(p.threadId, p.body, item.id);
    return r.ok ? { result: 'sent', data: r.message } : { result: 'drop', error: r.error };
  });
}
