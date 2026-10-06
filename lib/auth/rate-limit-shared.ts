// lib/auth/rate-limit-shared.ts
// Rate limiting that holds across serverless instances. State lives in Postgres
// (table auth_rate_limits + function auth_rate_limit_hit, see
// database/migrations/20261004_auth_hardening.sql). If the function is missing
// (migration not applied yet) or errors, it falls back to the in-memory limiter
// so auth never breaks - it just degrades to per-instance limits, with a warning.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { RateLimiter } from '@/lib/rate-limit';

export interface Limit {
  /** Stable namespace, e.g. "login:ip". */
  scope: string;
  /** Max hits per window. */
  max: number;
  windowSeconds: number;
}

const memory = new Map<string, RateLimiter>();
let warned = false;

function memoryHit(key: string, limit: Limit) {
  const id = `${limit.max}/${limit.windowSeconds}`;
  let limiter = memory.get(id);
  if (!limiter) {
    limiter = new RateLimiter({ limit: limit.max, windowMs: limit.windowSeconds * 1000 });
    memory.set(id, limiter);
  }
  const r = limiter.check(key);
  return { allowed: r.allowed, retryAfter: r.retryAfter };
}

export async function rateLimit(
  identifier: string,
  limit: Limit,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `${limit.scope}:${identifier.toLowerCase()}`;
  try {
    const { data, error } = await supabaseAdmin.rpc('auth_rate_limit_hit', {
      p_key: key,
      p_limit: limit.max,
      p_window_s: limit.windowSeconds,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('empty rate limit response');
    return { allowed: !!row.allowed, retryAfter: Number(row.retry_after ?? 0) };
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn('[rate-limit] shared store unavailable, using per-instance memory:', err instanceof Error ? err.message : err);
    }
    return memoryHit(key, limit);
  }
}

/** Checks several limits in order; the first one exceeded wins. */
export async function rateLimitAll(
  checks: Array<{ identifier: string; limit: Limit }>,
): Promise<{ allowed: boolean; retryAfter: number }> {
  for (const { identifier, limit } of checks) {
    const r = await rateLimit(identifier, limit);
    if (!r.allowed) return r;
  }
  return { allowed: true, retryAfter: 0 };
}

// Shared policies
export const LIMITS = {
  loginIp:      { scope: 'login:ip',      max: 20, windowSeconds: 600 },
  loginEmailIp: { scope: 'login:emailip', max: 8,  windowSeconds: 600 },
  loginEmail:   { scope: 'login:email',   max: 20, windowSeconds: 3600 },
  signupIp:     { scope: 'signup:ip',     max: 10, windowSeconds: 3600 },
  forgotIp:     { scope: 'forgot:ip',     max: 10, windowSeconds: 600 },
  resetIp:      { scope: 'reset:ip',      max: 15, windowSeconds: 600 },
  verifySignupIp: { scope: 'verify-signup:ip', max: 20, windowSeconds: 600 },
  resendSignupIp: { scope: 'resend-signup:ip', max: 10, windowSeconds: 600 },
  accountDeleteUser: { scope: 'acctdelete:user', max: 5, windowSeconds: 600 },
  passwordChangeUser: { scope: 'pwchange:user', max: 6, windowSeconds: 600 },
} satisfies Record<string, Limit>;
