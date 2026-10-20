'use client';

// The outbox: things a member writes that must not be lost on a bad connection.
// An item sits in IndexedDB (memory if the browser blocks it) as "Waiting to send", is sent when the
// connection allows, and is removed once the server confirms it.
//
// Rules this file enforces:
//  - Only kinds listed in OUTBOX_KINDS exist. Payments, sign-in, checkout and anything money-related are not
//    kinds and can never be added.
//  - Every item has a client id (a uuid). It is the idempotency key. A kind may be switched on only when the
//    server can recognise a repeat of that id and answer "already done".
//  - Writes are not given a hard timeout. The outbox only retries items, with a growing wait between tries.

export type OutboxKind = 'checkin' | 'circle_message' | 'dm_message';

export const OUTBOX_KINDS: readonly OutboxKind[] = ['checkin', 'circle_message', 'dm_message'];

/**
 * Which kinds are switched on.
 *  checkin:        on. The server allows one check-in per member per week (unique index), so a repeat is
 *                  answered 409 "already checked in", which the outbox counts as sent.
 *  circle_message: OFF. Needs the client_id column from
 *                  database/migrations/20261021_outbox_client_ids.sql. Apply it, then set this to true.
 */
export const OUTBOX_ENABLED: Record<OutboxKind, boolean> = {
  checkin: true,
  circle_message: false,
  dm_message: false,     // same migration as circle_message
};

export type OutboxStatus = 'waiting' | 'sending';

export interface OutboxItem<P = unknown> {
  id: string;          // idempotency key
  userId: string;      // owner: items are only sent while that account is signed in
  kind: OutboxKind;
  payload: P;
  createdAt: number;
  tries: number;
  nextAt: number;      // earliest time of the next attempt
}

/** What a handler tells the outbox. 'sent' also covers "the server already has it". 'drop' means it can never succeed. */
export type HandlerResult = { result: 'sent'; data?: unknown } | { result: 'retry' } | { result: 'drop'; error?: string };
export type Handler = (item: OutboxItem) => Promise<HandlerResult>;

export type OutboxEvent =
  | { type: 'queued'; item: OutboxItem }
  | { type: 'sending'; item: OutboxItem }
  | { type: 'sent'; item: OutboxItem; data?: unknown }
  | { type: 'dropped'; item: OutboxItem; error?: string };

export function outboxOn(kind: OutboxKind): boolean {
  return OUTBOX_ENABLED[kind] === true;
}

// ── storage ──────────────────────────────────────────────────────────────────

const DB_NAME = 'ascentor-outbox';
const STORE = 'items';
const mem = new Map<string, OutboxItem>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = run(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function putItem(item: OutboxItem): Promise<void> {
  mem.set(item.id, item);
  const db = await openDb();
  if (db) { try { await tx(db, 'readwrite', (s) => s.put(item)); } catch { /* memory copy remains */ } }
}

async function deleteItem(id: string): Promise<void> {
  mem.delete(id);
  const db = await openDb();
  if (db) { try { await tx(db, 'readwrite', (s) => s.delete(id)); } catch { /* ignore */ } }
}

export async function listOutbox(userId?: string): Promise<OutboxItem[]> {
  const db = await openDb();
  let items: OutboxItem[] = [];
  if (db) { try { items = (await tx(db, 'readonly', (s) => s.getAll())) as OutboxItem[]; } catch { items = []; } }
  for (const m of mem.values()) if (!items.some((i) => i.id === m.id)) items.push(m);
  if (userId) items = items.filter((i) => i.userId === userId);
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

/** Deletes every unsent item. Called on sign-out and when a different account signs in. */
export async function clearOutbox(): Promise<void> {
  mem.clear();
  const db = await openDb();
  if (db) { try { await tx(db, 'readwrite', (s) => s.clear()); } catch { /* ignore */ } }
  emit({ type: 'dropped', item: { id: '*', userId: '', kind: 'checkin', payload: null, createdAt: 0, tries: 0, nextAt: 0 } });
}

// ── events ───────────────────────────────────────────────────────────────────

type Listener = (e: OutboxEvent) => void;
const listeners = new Set<Listener>();
function emit(e: OutboxEvent) { listeners.forEach((l) => { try { l(e); } catch { /* a listener must not break the queue */ } }); }

export function subscribeOutbox(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// ── queue ────────────────────────────────────────────────────────────────────

export function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for very old browsers: RFC 4122 v4 from getRandomValues or Math.random.
  const b = new Uint8Array(16);
  const c = (typeof crypto !== 'undefined' ? crypto : undefined) as Crypto | undefined;
  if (c?.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Puts an item in the outbox. Throws if the kind is not switched on, so nothing is queued that cannot be repeated safely. */
export async function enqueue<P>(input: { id?: string; userId: string; kind: OutboxKind; payload: P }): Promise<OutboxItem<P>> {
  if (!OUTBOX_KINDS.includes(input.kind) || !outboxOn(input.kind)) throw new Error(`Outbox is not enabled for ${input.kind}`);
  const item: OutboxItem<P> = { id: input.id ?? newClientId(), userId: input.userId, kind: input.kind, payload: input.payload, createdAt: Date.now(), tries: 0, nextAt: 0 };
  await putItem(item);
  emit({ type: 'queued', item });
  return item;
}

const handlers = new Map<OutboxKind, Handler>();
export function registerHandler(kind: OutboxKind, h: Handler): void { handlers.set(kind, h); }

let currentUser: string | null = null;
export function setOutboxUser(userId: string | null): void { currentUser = userId; }

/** Wait before try n (1-based): 2s, 4s, 8s ... capped at 5 minutes. */
export function backoffMs(tries: number): number {
  return Math.min(2000 * 2 ** Math.max(0, tries - 1), 5 * 60 * 1000);
}

let flushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Sends every due item, oldest first, one at a time. Safe to call as often as you like. */
export async function flushOutbox(force = false): Promise<void> {
  if (flushing || !currentUser) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  flushing = true;
  try {
    // One tab at a time, so two open tabs cannot send the same item together.
    const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
    const run = async () => {
      const items = await listOutbox(currentUser ?? undefined);
      let nextDue = Infinity;
      for (const item of items) {
        if (!force && item.nextAt > Date.now()) { nextDue = Math.min(nextDue, item.nextAt); continue; }
        const h = handlers.get(item.kind);
        if (!h || !outboxOn(item.kind)) continue;
        emit({ type: 'sending', item });
        let r: HandlerResult;
        try { r = await h(item); } catch { r = { result: 'retry' }; }
        if (r.result === 'sent') { await deleteItem(item.id); emit({ type: 'sent', item, data: r.data }); }
        else if (r.result === 'drop') { await deleteItem(item.id); emit({ type: 'dropped', item, error: r.error }); }
        else {
          const next = { ...item, tries: item.tries + 1, nextAt: Date.now() + backoffMs(item.tries + 1) };
          await putItem(next);
          emit({ type: 'queued', item: next });
          nextDue = Math.min(nextDue, next.nextAt);
          if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
        }
      }
      if (timer) clearTimeout(timer);
      timer = Number.isFinite(nextDue) ? setTimeout(() => { void flushOutbox(); }, Math.max(1000, nextDue - Date.now())) : null;
    };
    if (locks?.request) await locks.request('ascentor-outbox-flush', { ifAvailable: true }, async (lock) => { if (lock) await run(); });
    else await run();
  } finally { flushing = false; }
}

/** Flush on app start, on 'online', and when the tab becomes visible again. Call once, after handlers are registered. */
export function startOutbox(userId: string | null): () => void {
  setOutboxUser(userId);
  const onOnline = () => { void flushOutbox(true); };
  const onVisible = () => { if (document.visibilityState === 'visible') void flushOutbox(); };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  void flushOutbox();
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    if (timer) { clearTimeout(timer); timer = null; }
  };
}
