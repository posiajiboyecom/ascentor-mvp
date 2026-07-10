// lib/rate-limit.ts
// ─────────────────────────────────────────────────────────────
// Lightweight in-process sliding-window rate limiter.
//
// Uses a Map keyed by identifier (IP or userId). Each entry is
// a list of timestamps within the current window. On each call:
//   1. Prune timestamps older than windowMs
//   2. If remaining count >= limit → deny
//   3. Otherwise push current timestamp → allow
//
// Resets on server restart (fine for Vercel — use Redis for
// multi-region persistence if needed later).
//
// Usage:
//   const limiter = new RateLimiter({ limit: 20, windowMs: 60_000 });
//   const { allowed, retryAfter } = limiter.check(ip);
//   if (!allowed) return new Response('Too Many Requests', { status: 429 });
// ─────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:    boolean;
  remaining:  number;
  retryAfter: number; // seconds until the window resets (0 if allowed)
}

export interface RateLimiterOptions {
  limit:    number; // max requests per window
  windowMs: number; // window size in milliseconds
}

export class RateLimiter {
  private readonly limit:    number;
  private readonly windowMs: number;
  private readonly store:    Map<string, number[]> = new Map();

  constructor({ limit, windowMs }: RateLimiterOptions) {
    this.limit    = limit;
    this.windowMs = windowMs;
  }

  check(identifier: string): RateLimitResult {
    this.prune(); // L-07: prune expired entries on every check to prevent unbounded Map growth
    const now       = Date.now();
    const cutoff    = now - this.windowMs;
    const hits      = (this.store.get(identifier) ?? []).filter((t) => t > cutoff);

    if (hits.length >= this.limit) {
      // Oldest hit + window = when the first slot frees up
      const retryAfter = Math.ceil((hits[0] + this.windowMs - now) / 1000);
      this.store.set(identifier, hits);
      return { allowed: false, remaining: 0, retryAfter };
    }

    hits.push(now);
    this.store.set(identifier, hits);
    return { allowed: true, remaining: this.limit - hits.length, retryAfter: 0 };
  }

  /** Prune all expired windows (call periodically to avoid memory growth). */
  prune() {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, hits] of this.store) {
      const live = hits.filter((t) => t > cutoff);
      if (live.length === 0) this.store.delete(key);
      else this.store.set(key, live);
    }
  }
}

// ── Shared limiter instances ──────────────────────────────────
// Module-level singletons so state persists across requests
// within the same serverless function instance.

/** Coach session: 30 requests per 10 minutes per IP */
export const coachSessionLimiter = new RateLimiter({
  limit:    30,
  windowMs: 10 * 60 * 1000,
});

/** Payment routes: 10 requests per minute per IP */
export const paymentLimiter = new RateLimiter({
  limit:    10,
  windowMs: 60 * 1000,
});

/** Auth / sensitive routes: 5 requests per minute per IP */
export const strictLimiter = new RateLimiter({
  limit:    5,
  windowMs: 60 * 1000,
});

/**
 * Extract the real client IP from request headers.
 * Prefers x-vercel-forwarded-for (Vercel's tamper-proof header, set by the
 * platform — cannot be spoofed by the client), then falls back to
 * x-forwarded-for for non-Vercel environments.
 */
export function getClientIp(req: Request): string {
  // x-vercel-forwarded-for is set by Vercel's edge and cannot be spoofed
  const vercelIp = req.headers.get('x-vercel-forwarded-for');
  if (vercelIp) return vercelIp.split(',')[0].trim();
  // Fallback for local dev / non-Vercel deployments
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
