// lib/keepalive.ts
// A deliberately tiny database touch that counts as project activity, so a free Supabase project is
// never paused for inactivity. One indexed read of one row: no writes, no scans, no secrets exposed.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface KeepAliveResult {
  ok: boolean;
  ms: number;
  at: string;
  error?: string;
}

export async function pingDatabase(): Promise<KeepAliveResult> {
  const started = Date.now();
  const at = new Date().toISOString();
  try {
    const { error } = await supabaseAdmin.from('platform_settings').select('key').limit(1);
    if (error) throw error;
    return { ok: true, ms: Date.now() - started, at };
  } catch (err) {
    return { ok: false, ms: Date.now() - started, at, error: err instanceof Error ? err.message : String(err) };
  }
}
