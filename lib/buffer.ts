// ═══════════════════════════════════════════════════════════
// Buffer API Helper
// Handles scheduling posts to Buffer via the Publish API v1
// Docs: https://buffer.com/developers/api
// ═══════════════════════════════════════════════════════════

const BUFFER_API_BASE = "https://api.bufferapp.com/1";

export interface BufferProfile {
  id: string;
  service: string; // "twitter", "linkedin", "facebook", "instagram"
  service_username: string;
  formatted_username: string;
}

export interface BufferUpdatePayload {
  profile_ids: string[];
  text: string;
  scheduled_at?: string; // ISO 8601 — if omitted, adds to queue
  now?: boolean;         // post immediately
  shorten?: boolean;     // shorten URLs
  top?: boolean;         // add to top of queue
}

export interface BufferResult {
  success: boolean;
  update_id?: string;
  profile_id?: string;
  error?: string;
}

// ── Get all connected profiles ────────────────────────────
export async function getBufferProfiles(): Promise<BufferProfile[]> {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) throw new Error("BUFFER_ACCESS_TOKEN is not set");

  const res = await fetch(`${BUFFER_API_BASE}/profiles.json?access_token=${token}`);
  if (!res.ok) throw new Error(`Buffer profiles error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  return data.map((p: any) => ({
    id: p.id,
    service: p.service,
    service_username: p.service_username,
    formatted_username: p.formatted_username,
  }));
}

// ── Schedule a single post to Buffer ─────────────────────
export async function scheduleBufferPost(
  payload: BufferUpdatePayload
): Promise<BufferResult[]> {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) throw new Error("BUFFER_ACCESS_TOKEN is not set");

  const results: BufferResult[] = [];

  // Buffer API requires one profile per request for scheduled_at
  for (const profileId of payload.profile_ids) {
    const body = new URLSearchParams();
    body.append("access_token", token);
    body.append("profile_ids[]", profileId);
    body.append("text", payload.text);

    if (payload.scheduled_at) {
      // Convert ISO string to Unix timestamp (Buffer requires this)
      const unixTime = Math.floor(new Date(payload.scheduled_at).getTime() / 1000);
      body.append("scheduled_at", unixTime.toString());
    }

    if (payload.now) body.append("now", "true");
    if (payload.shorten !== false) body.append("shorten", "true");
    if (payload.top) body.append("top", "true");

    const res = await fetch(`${BUFFER_API_BASE}/updates/create.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = await res.json();

    if (!res.ok || data.success === false) {
      results.push({
        success: false,
        profile_id: profileId,
        error: data.message || data.error || `HTTP ${res.status}`,
      });
    } else {
      results.push({
        success: true,
        update_id: data.update?.id || data.updates?.[0]?.id,
        profile_id: profileId,
      });
    }
  }

  return results;
}

// ── Map Ascentor platform name → Buffer service name ─────
export function platformToBufferService(platform: string): string {
  const map: Record<string, string> = {
    "LinkedIn":   "linkedin",
    "Twitter/X":  "twitter",
    "Twitter":    "twitter",
    "X":          "twitter",
    "Instagram":  "instagram",
    "Facebook":   "facebook",
  };
  return map[platform] || platform.toLowerCase();
}

// ── Get profile IDs for a specific platform ───────────────
export async function getProfileIdsForPlatform(
  platform: string,
  profiles: BufferProfile[]
): Promise<string[]> {
  const service = platformToBufferService(platform);
  return profiles
    .filter(p => p.service === service)
    .map(p => p.id);
}
