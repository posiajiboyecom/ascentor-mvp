// lib/admin/settings.ts
// Server-only. Platform settings the admin can change (Plans and pricing, Platform settings), stored in the existing
// public.platform_settings table (key text, value text). Every key lives under the "admin." prefix so it can never collide
// with the older keys (checkout_enabled, summit_stream_*). Values are strings; helpers parse them with a default, so a missing
// row, a missing table or a bad value always falls back to the default and never breaks a page.

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

const PREFIX = 'admin.';

/** Defaults for every setting the console exposes. Add a key here before using it. */
export const SETTING_DEFAULTS = {
  // Plans: which plans are open for sign-ups (checkout hides and refuses a closed plan)
  'plan.seeker.open': 'true',
  'plan.builder.open': 'true',
  'plan.leader.open': 'true',
  // Billing
  'billing.extra_days': '7',           // extra days on the first payment (pay now, get 7 extra days)
  'billing.grace_days': '7',           // days after a failed payment before light access starts
  // What a member keeps on light access
  'light.today': 'true', 'light.chat': 'true', 'light.sage': 'true', 'light.learn': 'false', 'light.mentor': 'false', 'light.groups': 'false',
  // Circles
  'circle.size_min': '4', 'circle.size_max': '10', 'circle.cycle_days': '84', 'circle.call_start_share': '60', 'circle.call_minutes': '60',
  // Calls and mentorship
  'call.audio_first': 'true', 'call.video_allowed': 'true', 'mentor.needs_agenda': 'true', 'mentor.agenda_questions': '3', 'mentor.session_minutes': '60',
  // Features
  'feature.shop': 'true', 'feature.cities': 'true', 'feature.refer': 'true', 'feature.dock': 'true', 'feature.offline': 'true',
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

/** All settings as strings, defaults filled in. One query. */
export async function getSettings(): Promise<Record<SettingKey, string>> {
  const out = { ...SETTING_DEFAULTS } as Record<SettingKey, string>;
  try {
    const { data } = await supabaseAdmin.from('platform_settings').select('key, value').like('key', `${PREFIX}%`);
    for (const r of data ?? []) {
      const k = String(r.key).slice(PREFIX.length) as SettingKey;
      if (k in SETTING_DEFAULTS && typeof r.value === 'string') out[k] = r.value;
    }
  } catch { /* defaults */ }
  return out;
}

export async function getSetting(key: SettingKey): Promise<string> {
  return (await getSettings())[key];
}

export const asBool = (v: string) => v === 'true';
export const asInt = (v: string, fallback: number, min = 0, max = 1_000_000) => {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** Save one setting. Validates the key; the caller validates the value. Returns an error message or null. */
export async function setSetting(key: SettingKey, value: string): Promise<string | null> {
  if (!(key in SETTING_DEFAULTS)) return 'Unknown setting.';
  const { error } = await supabaseAdmin.from('platform_settings').upsert({ key: PREFIX + key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return error ? 'We could not save that. Please try again.' : null;
}
