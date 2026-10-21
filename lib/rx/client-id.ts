// lib/rx/client-id.ts
// Idempotency for chat messages sent through the outbox. The browser makes a uuid per message (client_id).
// If the same id arrives twice, the second call returns the first message instead of posting again.
// Safe before the migration: if the client_id column does not exist yet, these helpers do nothing and the
// message is posted as before (no dedupe, so the chat outbox stays switched off until the column exists).

import type { SupabaseClient } from '@supabase/supabase-js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanClientId(v: unknown): string | null {
  return typeof v === 'string' && UUID.test(v) ? v.toLowerCase() : null;
}

/** Postgres 42703 / PostgREST PGRST204: the column is not there yet. */
export function isMissingColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  return !!err && (err.code === '42703' || err.code === 'PGRST204' || /client_id/.test(err.message ?? '') && /column/.test(err.message ?? ''));
}

export function isUniqueViolation(err: { code?: string } | null | undefined): boolean {
  return !!err && err.code === '23505';
}

/** The message this member already posted with this client id, or null (also null when the column is missing). */
export async function findByClientId(
  db: SupabaseClient, table: 'circle_messages' | 'dm_messages', ownerColumn: 'user_id' | 'sender_id',
  ownerId: string, clientId: string | null,
): Promise<{ id: string; created_at: string; body: string } | null> {
  if (!clientId) return null;
  const { data, error } = await db.from(table).select('id, created_at, body').eq(ownerColumn, ownerId).eq('client_id', clientId).maybeSingle();
  if (error || !data) return null;
  return data as { id: string; created_at: string; body: string };
}
