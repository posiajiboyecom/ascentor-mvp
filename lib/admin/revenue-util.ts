// lib/admin/revenue-util.ts
// Small formatting helpers shared by the revenue console screens (payments, promos, referrals, products, orders). Server only.
import 'server-only';

export const naira = (n: number | null | undefined) => (n == null || !Number.isFinite(Number(n)) ? '\-' : '₦' + Math.round(Number(n)).toLocaleString('en-NG'));
export const count = (n: number) => n.toLocaleString('en-NG');

const TZ = 'Africa/Lagos';
export const shortDate = (iso: string | null | undefined) => {
  if (!iso) return '\-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '\-';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
};

/** ISO instant of the first moment of the current month in Lagos (UTC+1, no daylight saving). */
export function lagosMonthStartIso(now = new Date()): string {
  const ym = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).format(now); // 2026-10
  return new Date(`${ym}-01T00:00:00+01:00`).toISOString();
}

export const isMissingSchema = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(e.code || '') || /does not exist|schema cache/i.test(e.message || ''));

export const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@\t\r])/, "'$1")}"`;
