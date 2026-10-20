import 'server-only';
// lib/rx/cities.ts
// City groups are ordinary rx_groups rows with is_city = true (slug "city-<name>"). This reads them with the
// member's own session. The table has no country column, so the country shown on each card comes from COUNTRY.

import { getGroups, type GroupView } from './community';
import { slugify } from './shell-counts';

const COUNTRY: Record<string, string> = {
  lagos: 'Nigeria', abuja: 'Nigeria', 'port-harcourt': 'Nigeria', ibadan: 'Nigeria',
  accra: 'Ghana', nairobi: 'Kenya', london: 'United Kingdom',
};

export interface CityView extends GroupView { country: string; isMine: boolean }

export async function getCityGroups(myCity: string | null | undefined): Promise<CityView[]> {
  const mine = myCity ? `city-${slugify(myCity)}` : null;
  return (await getGroups())
    .filter((g) => g.isCity)
    .map((g) => ({ ...g, country: COUNTRY[g.slug.replace(/^city-/, '')] ?? 'Elsewhere', isMine: g.slug === mine }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
