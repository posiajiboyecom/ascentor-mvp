'use server';

// Platform settings: one save for the whole screen. The level is checked first, every value is validated here (never trust
// the form), and the change is audited after it succeeds.
import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { SETTING_DEFAULTS, getSettings, setSetting, type SettingKey } from '@/lib/admin/settings';

export type PlatformValues = Record<SettingKey, string>;
export interface PlatformResult { ok: boolean; error?: string; message?: string }

const PLATFORM_KEYS = [
  'circle.size_min', 'circle.size_max', 'circle.cycle_days', 'circle.call_start_share', 'circle.call_minutes',
  'call.audio_first', 'call.video_allowed', 'mentor.needs_agenda', 'mentor.agenda_questions', 'mentor.session_minutes',
  'feature.shop', 'feature.cities', 'feature.refer', 'feature.dock', 'feature.offline',
] as const satisfies readonly SettingKey[];

const RANGES: Partial<Record<SettingKey, [number, number, string]>> = {
  'circle.size_min': [2, 50, 'Smallest Circle size'],
  'circle.size_max': [2, 100, 'Largest Circle size'],
  'circle.cycle_days': [7, 365, 'Cycle length'],
  'circle.call_start_share': [1, 100, 'Call start share'],
  'circle.call_minutes': [5, 240, 'Circle call length'],
  'mentor.agenda_questions': [1, 50, 'Questions needed'],
  'mentor.session_minutes': [5, 240, 'Mentor session length'],
};
const BOOLS: SettingKey[] = ['call.audio_first', 'call.video_allowed', 'mentor.needs_agenda', 'feature.shop', 'feature.cities', 'feature.refer', 'feature.dock', 'feature.offline'];

/** Settings the member app reads today. The rest are stored and wait for the app to read them. */
const LIVE: SettingKey[] = ['feature.shop', 'feature.cities', 'feature.refer', 'feature.dock', 'feature.offline', 'mentor.agenda_questions', 'mentor.needs_agenda'];

export async function savePlatformSettings(input: Partial<Record<string, string>>): Promise<PlatformResult> {
  try {
    const staff = await staffForAction();
    staff.require('platform', 'edit');

    const clean: Partial<Record<SettingKey, string>> = {};
    for (const key of PLATFORM_KEYS) {
      const raw = String(input[key] ?? SETTING_DEFAULTS[key]).trim();
      if (BOOLS.includes(key)) {
        if (raw !== 'true' && raw !== 'false') return { ok: false, error: 'One of the switches has a value we do not recognise. Reload and try again.' };
        clean[key] = raw;
        continue;
      }
      const [min, max, label] = RANGES[key]!;
      const n = Number(raw.replace(/%$/, ''));
      if (!raw || !Number.isInteger(n) || n < min || n > max) return { ok: false, error: `${label} must be a whole number from ${min} to ${max}.` };
      clean[key] = String(n);
    }
    if (Number(clean['circle.size_min']) > Number(clean['circle.size_max'])) return { ok: false, error: 'The smallest Circle size cannot be bigger than the largest.' };

    const before = await getSettings();
    const changed = PLATFORM_KEYS.filter((k) => before[k] !== clean[k]);
    for (const key of changed) {
      const err = await setSetting(key, clean[key]!);
      if (err) return { ok: false, error: err };
    }
    if (changed.length) await auditAdmin(staff, 'Saved changes', 'Platform settings', 'Platform settings');

    revalidatePath('/', 'layout');
    revalidatePath('/admin/c/platform');
    const storedOnly = changed.some((k) => !LIVE.includes(k));
    return {
      ok: true,
      message: !changed.length ? 'Nothing to save. Everything is already set that way.' : storedOnly ? 'Saved. Switches and agenda settings are live now. The other values apply when the app reads them.' : 'Saved. Members see the change straight away.',
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'We could not save that. Please try again.' };
  }
}
