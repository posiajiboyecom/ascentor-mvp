// lib/admin/screens/index.ts
// Registry of the console's list screens. Each screen is a module with a static spec, a loader and action handlers
// (see lib/admin/types.ts). Bespoke screens (overview, team, chats, plans, platform, recs, analysis) are separate pages.
import type { ScreenModule } from '@/lib/admin/types';

const loaders: Record<string, () => Promise<{ default: ScreenModule }>> = {
  announcements: () => import('./announcements'),
  audit: () => import('./audit'),
  billboards: () => import('./billboards'),
  blog: () => import('./blog'),
  broadcasts: () => import('./broadcasts'),
  careers: () => import('./careers'),
  categories: () => import('./categories'),
  circles: () => import('./circles'),
  cities: () => import('./cities'),
  donations: () => import('./donations'),
  events: () => import('./events'),
  groups: () => import('./groups'),
  intel: () => import('./intel'),
  knowledge: () => import('./knowledge'),
  livestream: () => import('./livestream'),
  matching: () => import('./matching'),
  meetups: () => import('./meetups'),
  members: () => import('./members'),
  mentors: () => import('./mentors'),
  mentorship: () => import('./mentorship'),
  moderation: () => import('./moderation'),
  newsletter: () => import('./newsletter'),
  orders: () => import('./orders'),
  pages: () => import('./pages'),
  partners: () => import('./partners'),
  pathways: () => import('./pathways'),
  payments: () => import('./payments'),
  products: () => import('./products'),
  referrals: () => import('./referrals'),
  registrations: () => import('./registrations'),
  recs: () => import('./recs'),
  reports: () => import('./reports'),
  surveys: () => import('./surveys'),
};

export async function getScreen(area: string): Promise<ScreenModule | null> {
  const load = loaders[area];
  return load ? (await load()).default : null;
}

export const SCREEN_KEYS = Object.keys(loaders);
