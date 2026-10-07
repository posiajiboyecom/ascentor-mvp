// lib/rx/timezones.ts
// Time zone lookup for onboarding: country names for common zones, the full IANA list from the browser,
// and city / country / offset labels. Safe to import on the client.

import { tzOffset } from './dates';

export const TZC: Record<string, string> = {'Africa/Lagos':'Nigeria','Africa/Nairobi':'Kenya','Africa/Accra':'Ghana','Africa/Johannesburg':'South Africa','Africa/Cairo':'Egypt','Africa/Casablanca':'Morocco','Africa/Kigali':'Rwanda','Africa/Kampala':'Uganda','Africa/Dar_es_Salaam':'Tanzania','Africa/Addis_Ababa':'Ethiopia','Africa/Abidjan':'Côte d’Ivoire','Africa/Dakar':'Senegal','Africa/Douala':'Cameroon','Africa/Kinshasa':'DR Congo','Africa/Luanda':'Angola','Africa/Harare':'Zimbabwe','Africa/Lusaka':'Zambia','Africa/Algiers':'Algeria','Africa/Tunis':'Tunisia','Africa/Khartoum':'Sudan','Africa/Monrovia':'Liberia','Africa/Freetown':'Sierra Leone','Africa/Bamako':'Mali','Africa/Niamey':'Niger','Africa/Ndjamena':'Chad','Africa/Porto-Novo':'Benin','Africa/Lome':'Togo','Africa/Maputo':'Mozambique','Africa/Windhoek':'Namibia','Africa/Gaborone':'Botswana','Europe/London':'United Kingdom','Europe/Dublin':'Ireland','Europe/Paris':'France','Europe/Berlin':'Germany','Europe/Amsterdam':'Netherlands','Europe/Madrid':'Spain','Europe/Rome':'Italy','Europe/Lisbon':'Portugal','Europe/Brussels':'Belgium','Europe/Zurich':'Switzerland','Europe/Stockholm':'Sweden','Europe/Oslo':'Norway','Europe/Warsaw':'Poland','Europe/Istanbul':'Türkiye','Europe/Moscow':'Russia','Europe/Kyiv':'Ukraine','Europe/Kiev':'Ukraine','Asia/Dubai':'United Arab Emirates','Asia/Riyadh':'Saudi Arabia','Asia/Qatar':'Qatar','Asia/Kolkata':'India','Asia/Calcutta':'India','Asia/Karachi':'Pakistan','Asia/Dhaka':'Bangladesh','Asia/Singapore':'Singapore','Asia/Shanghai':'China','Asia/Hong_Kong':'Hong Kong','Asia/Tokyo':'Japan','Asia/Seoul':'South Korea','Asia/Jakarta':'Indonesia','Asia/Manila':'Philippines','Asia/Kuala_Lumpur':'Malaysia','Asia/Bangkok':'Thailand','Asia/Jerusalem':'Israel','Asia/Tehran':'Iran','Asia/Baghdad':'Iraq','Asia/Amman':'Jordan','Asia/Beirut':'Lebanon','Asia/Kathmandu':'Nepal','Asia/Colombo':'Sri Lanka','Asia/Ho_Chi_Minh':'Vietnam','Asia/Taipei':'Taiwan','Australia/Sydney':'Australia','Australia/Melbourne':'Australia','Australia/Perth':'Australia','Pacific/Auckland':'New Zealand','America/New_York':'United States','America/Chicago':'United States','America/Denver':'United States','America/Los_Angeles':'United States','America/Toronto':'Canada','America/Vancouver':'Canada','America/Mexico_City':'Mexico','America/Sao_Paulo':'Brazil','America/Bogota':'Colombia','America/Lima':'Peru','America/Santiago':'Chile','America/Argentina/Buenos_Aires':'Argentina','America/Jamaica':'Jamaica','America/Port_of_Spain':'Trinidad and Tobago','Atlantic/Reykjavik':'Iceland','UTC':'Coordinated Universal Time'};

export interface TzInfo { id: string; city: string; country: string; off: string }

export function tzInfo(z: string): TzInfo {
  const parts = z.split('/');
  let city = parts[parts.length - 1].replace(/_/g, ' ');
  if (z === 'UTC') city = 'UTC';
  return { id: z, city, country: TZC[z] || parts[0], off: tzOffset(z) };
}

let cache: TzInfo[] | null = null;
export function allZones(): TzInfo[] {
  if (cache) return cache;
  let ids: string[] = [];
  try { const f = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf; if (f) ids = f('timeZone'); } catch { /* older browsers */ }
  if (!ids.length) ids = Object.keys(TZC);
  ids = ids.filter((z) => !z.startsWith('Etc/'));
  if (!ids.includes('UTC')) ids.push('UTC');
  cache = ids.map(tzInfo);
  return cache;
}

export function detectedZone(): TzInfo {
  let z = 'Africa/Lagos';
  try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || z; } catch { /* keep default */ }
  return tzInfo(z);
}

/** Popular zones (Africa first), or search results across every zone. */
export function searchZones(query: string): { list: TzInfo[]; total: number; popular: boolean } {
  const zones = allZones();
  const q = query.trim().toLowerCase();
  if (!q) {
    const list = zones.filter((z) => TZC[z.id] && z.id !== 'Europe/Kiev' && z.id !== 'Asia/Calcutta');
    list.sort((a, b) => {
      const ra = a.id.startsWith('Africa/') ? 0 : 1, rb = b.id.startsWith('Africa/') ? 0 : 1;
      return ra - rb || a.city.localeCompare(b.city);
    });
    return { list, total: zones.length, popular: true };
  }
  const list = zones.filter((z) => z.city.toLowerCase().includes(q) || z.country.toLowerCase().includes(q) || z.id.toLowerCase().includes(q));
  list.sort((a, b) => {
    const sa = a.city.toLowerCase().startsWith(q) ? 0 : 1, sb = b.city.toLowerCase().startsWith(q) ? 0 : 1;
    return sa - sb || a.city.localeCompare(b.city);
  });
  return { list, total: list.length, popular: false };
}
