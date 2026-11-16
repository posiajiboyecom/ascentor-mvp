// lib/rx/city-names.ts
// Tidies the city a member types, so "akure ", "AKURE" and "Akure, Ondo" all mean one city group.
// Safe on client and server.

/** Common ways people write the same city. Keys are lower case. */
const ALIASES: Record<string, string> = {
  ph: 'Port Harcourt', 'port-harcourt': 'Port Harcourt', portharcourt: 'Port Harcourt',
  fct: 'Abuja', 'abuja fct': 'Abuja', 'fct abuja': 'Abuja',
  'lagos island': 'Lagos', 'lagos mainland': 'Lagos', ikeja: 'Lagos', lekki: 'Lagos', ojo: 'Lagos', yaba: 'Lagos', ikorodu: 'Lagos', 'victoria island': 'Lagos', surulere: 'Lagos', ajah: 'Lagos', epe: 'Lagos', badagry: 'Lagos',
  'ile ife': 'Ile-Ife', ife: 'Ile-Ife', 'ado ekiti': 'Ado-Ekiti', 'ado-ekiti': 'Ado-Ekiti', abeokuta: 'Abeokuta', 'benin': 'Benin City', 'benin city': 'Benin City',
};

/** Quick picks shown at sign-up. Anything else can be typed. */
export const CITY_SUGGESTIONS = ['Lagos', 'Abuja', 'Ibadan', 'Port Harcourt', 'Akure', 'Benin City', 'Enugu', 'Kano', 'Ilorin', 'Abeokuta', 'Osogbo', 'Ado-Ekiti', 'Jos', 'Kaduna', 'Owerri', 'Uyo', 'Calabar', 'Warri'];

const title = (w: string) => w.replace(/(^|[\s-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());

/** "  akure, ondo state " -> "Akure". Returns null if nothing usable is left. */
export function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Keep only the city part of "City, State" / "City, Country".
  let s = raw.split(',')[0].replace(/\s+/g, ' ').trim();
  s = s.replace(/\b(city|state|metropolis)$/i, (m) => (/^city$/i.test(m) && /^benin\b/i.test(s) ? m : '')).trim();
  if (!s || s.length > 60 || !/[a-z]/i.test(s)) return null;
  const alias = ALIASES[s.toLowerCase()];
  if (alias) return alias;
  return title(s.toLowerCase());
}
