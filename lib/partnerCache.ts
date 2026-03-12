// ============================================================
// lib/partnerCache.ts
//
// Distributed cache for partner context.
// Uses Upstash Redis when KV_REST_API_URL + KV_REST_API_TOKEN
// are set (Vercel KV / Upstash). Falls back to a per-process
// Map when running locally or if env vars are absent.
//
// This replaces the in-process Map in getPartnerContext.ts,
// which silently broke across Vercel serverless instances —
// clearPartnerCache only cleared ONE instance's memory.
//
// ENV (optional — fallback works without them):
//   KV_REST_API_URL   — Upstash REST endpoint
//   KV_REST_API_TOKEN — Upstash read-write token
// ============================================================

const CACHE_TTL_SECONDS = 60; // 60s TTL matches original

// ── Local fallback (single-process / local dev) ───────────

const localCache = new Map<string, { value: string; expires: number }>();

function localGet(key: string): string | null {
  const entry = localCache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) { localCache.delete(key); return null; }
  return entry.value;
}

function localSet(key: string, value: string): void {
  localCache.set(key, { value, expires: Date.now() + CACHE_TTL_SECONDS * 1000 });
}

function localDel(key: string): void {
  localCache.delete(key);
}

function localDelPattern(prefix: string): void {
  for (const k of localCache.keys()) {
    if (k.startsWith(prefix) || k.includes(prefix)) {
      localCache.delete(k);
    }
  }
}

// ── Upstash helpers ───────────────────────────────────────

function upstashHeaders() {
  return {
    Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function upstashUrl(path: string): string {
  return `${process.env.KV_REST_API_URL}${path}`;
}

async function upstashGet(key: string): Promise<string | null> {
  try {
    const res  = await fetch(upstashUrl(`/get/${encodeURIComponent(key)}`), {
      headers: upstashHeaders(),
      // Disable Next.js fetch cache so we always hit Upstash
      cache: 'no-store',
    });
    const data = await res.json();
    return data.result ?? null;
  } catch (err) {
    console.warn('[partnerCache] Upstash GET failed, falling back to local:', err);
    return localGet(key);
  }
}

async function upstashSet(key: string, value: string): Promise<void> {
  try {
    await fetch(upstashUrl(`/set/${encodeURIComponent(key)}`), {
      method:  'POST',
      headers: upstashHeaders(),
      body:    JSON.stringify([value, 'EX', CACHE_TTL_SECONDS]),
    });
  } catch (err) {
    console.warn('[partnerCache] Upstash SET failed, writing to local:', err);
    localSet(key, value);
  }
}

async function upstashDel(key: string): Promise<void> {
  try {
    await fetch(upstashUrl(`/del/${encodeURIComponent(key)}`), {
      method:  'POST',
      headers: upstashHeaders(),
    });
  } catch (err) {
    console.warn('[partnerCache] Upstash DEL failed:', err);
    localDel(key);
  }
}

// Upstash doesn't support wildcard delete natively on the REST API
// so we use SCAN to find keys matching the pattern.
async function upstashDelPattern(pattern: string): Promise<void> {
  try {
    // Scan for matching keys (cursor-based)
    let cursor = '0';
    const keysToDelete: string[] = [];

    do {
      const res = await fetch(
        upstashUrl(`/scan/${cursor}?match=*${encodeURIComponent(pattern)}*&count=100`),
        { headers: upstashHeaders(), cache: 'no-store' }
      );
      const data = await res.json();
      cursor = String(data.result[0]);
      const keys: string[] = data.result[1] || [];
      keysToDelete.push(...keys);
    } while (cursor !== '0');

    await Promise.all(keysToDelete.map(k => upstashDel(k)));
  } catch (err) {
    console.warn('[partnerCache] Upstash SCAN/DEL pattern failed:', err);
    localDelPattern(pattern);
  }
}

// ── Public interface ──────────────────────────────────────

const hasUpstash = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

export async function cacheGet(key: string): Promise<string | null> {
  if (hasUpstash) return upstashGet(key);
  return localGet(key);
}

export async function cacheSet(key: string, value: string): Promise<void> {
  if (hasUpstash) return upstashSet(key, value);
  localSet(key, value);
}

export async function cacheDel(key: string): Promise<void> {
  if (hasUpstash) return upstashDel(key);
  localDel(key);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (hasUpstash) return upstashDelPattern(pattern);
  localDelPattern(pattern);
}
