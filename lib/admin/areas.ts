// lib/admin/areas.ts
// Client-safe definitions for the admin console, copied from the admin prototype: the navigation groups, the
// access levels, the default roles and the status colours. Nothing here touches the database.

export type Level = 'none' | 'view' | 'edit' | 'full';
export const RANK: Record<Level, number> = { none: 0, view: 1, edit: 2, full: 3 };
export const LEVELS: [Level, string][] = [['none', 'No access'], ['view', 'View'], ['edit', 'Edit'], ['full', 'Full']];

export const LEVEL_GUIDE: [string, string][] = [
  ['No access', 'Hidden from the menu, search, Overview and exports.'],
  ['View', 'Can open and search it, but not change anything.'],
  ['Edit', 'Can change things: approve, assign, publish.'],
  ['Full', 'Can also export, delete and refund.'],
];

/** [area key, label, flagged]. The flag is the prototype's third item (admin-heavy areas). */
export type NavItem = [string, string, number?];
export const NAV: [string, NavItem[]][] = [
  ['Overview', [['overview', 'Overview'], ['recs', 'Recommendations', 1]]],
  ['People', [['members', 'Members'], ['team', 'Team and access', 1], ['mentors', 'Mentors']]],
  ['Circles', [['circles', 'Circles'], ['matching', 'Waiting for a Circle'], ['mentorship', 'Mentor sessions']]],
  ['Community', [['groups', 'Groups'], ['cities', 'City groups'], ['meetups', 'Meetups'], ['categories', 'Post categories'], ['announcements', 'Announcements'], ['broadcasts', 'Broadcasts'], ['moderation', 'Moderation'], ['chats', 'Conversations', 1]]],
  ['Learn', [['pathways', 'Pathways and lessons'], ['knowledge', 'Sage knowledge base']]],
  ['Revenue', [['payments', 'Payments', 1], ['plans', 'Plans and pricing', 1], ['referrals', 'Referrals', 1], ['products', 'Shop products', 1], ['orders', 'Shop orders', 1]]],
  ['Elevation Summit', [['registrations', 'Registrations', 1], ['donations', 'Donations', 1], ['livestream', 'Livestream', 1]]],
  ['Marketing', [['blog', 'Blog'], ['pages', 'Landing pages', 1], ['newsletter', 'Email'], ['billboards', 'Billboards', 1], ['partners', 'Partners', 1], ['careers', 'Careers', 1], ['events', 'Public events', 1]]],
  ['Insights', [['analysis', 'AI analysis', 1], ['intel', 'Platform intel'], ['reports', 'Reports'], ['surveys', 'Surveys'], ['audit', 'Audit log', 1]]],
  ['Settings', [['platform', 'Platform settings', 1]]],
];

export interface AreaInfo { key: string; label: string; group: string; flagged: boolean }
export const AREAS: AreaInfo[] = NAV.flatMap(([group, items]) => items.map(([key, label, f]) => ({ key, label, group, flagged: !!f })));
export const AREA_KEYS = AREAS.map((a) => a.key);
export const areaOf = (key: string) => AREAS.find((a) => a.key === key);

/** Where an area lives. Overview is the admin home; everything else is /admin/c/<key>. */
export const areaHref = (key: string) => (key === 'overview' ? '/admin' : `/admin/c/${key}`);

/** Areas that have their own page (bespoke screens in the prototype); the rest use the generic list screen. */
export const BESPOKE = ['overview', 'team', 'chats', 'plans', 'platform', 'recs', 'analysis'] as const;

// ── roles ──────────────────────────────────────────────────────────────────
export interface RoleDef { id: string; name: string; locked?: boolean; levels: Record<string, Level> }

export const DEFAULT_ROLES: RoleDef[] = [
  { id: 'admin', name: 'Admin', locked: true, levels: {} },
  { id: 'moderator', name: 'Moderator', levels: { overview: 'view', members: 'view', mentors: 'edit', circles: 'edit', matching: 'edit', mentorship: 'view', groups: 'edit', cities: 'edit', meetups: 'edit', categories: 'edit', announcements: 'edit', moderation: 'full', pathways: 'edit', knowledge: 'edit', blog: 'edit', newsletter: 'edit', intel: 'view', reports: 'view' } },
  { id: 'community', name: 'Community manager', levels: { overview: 'view', recs: 'edit', members: 'view', mentors: 'view', circles: 'edit', matching: 'edit', mentorship: 'edit', groups: 'edit', cities: 'edit', meetups: 'edit', categories: 'edit', announcements: 'edit', broadcasts: 'edit', moderation: 'full', chats: 'view', analysis: 'view' } },
  { id: 'finance', name: 'Finance', levels: { overview: 'view', members: 'view', payments: 'full', plans: 'edit', referrals: 'edit', products: 'view', orders: 'full', registrations: 'view', donations: 'full', reports: 'full' } },
  { id: 'summit', name: 'Summit team', levels: { overview: 'view', announcements: 'edit', orders: 'view', registrations: 'full', donations: 'view', livestream: 'full', events: 'edit' } },
];

// ── status colours (a dot plus the word, never colour alone) ────────────────
const GOOD = ['Active', 'Paid', 'Published', 'Live', 'Confirmed', 'Indexed', 'Healthy', 'Approved', 'Delivered', 'Rewarded', 'Open', 'Sent', 'Held', 'Ready', 'Matched', 'Booked', 'Connected', 'Leader', 'Removed by admin', 'Resolved'];
const WARN = ['Trial', 'Grace', 'Pending', 'Draft', 'Scheduled', 'Processing', 'Waiting', 'Voting', 'Packing', 'Forming', 'Needs facilitator', 'Low quorum', 'Quiet', 'Not confirmed', 'Past due', 'Requested', 'Agenda draft', 'Light access', 'Paused', 'Shipped', 'On trial', 'First period', 'Cancelled', 'Free', 'New', 'Not sent', 'Ended'];
const BAD = ['Failed', 'Lapsed', 'Broken', 'Suspended', 'Messaging blocked', 'Abandoned', 'Reported', 'Flagged', 'Expired', 'Out of stock', 'No agenda', 'Refunded', 'Rejected', 'Duplicate'];
export const toneOf = (v: string): 'good' | 'warn' | 'bad' | 'plain' => (GOOD.includes(v) ? 'good' : WARN.includes(v) ? 'warn' : BAD.includes(v) ? 'bad' : 'plain');

/** The level a role grants for an area ('admin' always has full). */
export function levelOf(role: RoleDef | undefined, area: string): Level {
  if (!role) return 'none';
  if (role.id === 'admin') return 'full';
  return role.levels[area] ?? 'none';
}
export const can = (level: Level, need: Level = 'view') => RANK[level] >= RANK[need];

// ── older admin pages -> the area that governs them ─────────────────────────
// The console screens (/admin/c/<area>) are enforced on the server. The older pages keep working at their own URLs, and this
// map lets the shell hide them from a role that has no access to the matching area.
const LEGACY: [string, string][] = [
  ['/admin/users', 'members'], ['/admin/permissions', 'team'], ['/admin/mentors', 'mentors'], ['/admin/human-mentors', 'mentors'],
  ['/admin/circles', 'circles'], ['/admin/groups', 'groups'], ['/admin/categories', 'categories'], ['/admin/announcements', 'announcements'],
  ['/admin/broadcasts', 'broadcasts'], ['/admin/moderation', 'moderation'], ['/admin/chats', 'chats'], ['/admin/coaching', 'chats'],
  ['/admin/community-intel', 'chats'], ['/admin/community-events', 'meetups'], ['/admin/courses', 'pathways'], ['/admin/lessons', 'pathways'], ['/admin/content', 'pathways'],
  ['/admin/knowledge', 'knowledge'], ['/admin/payments', 'payments'], ['/admin/products', 'products'],
  ['/admin/shop/products', 'products'], ['/admin/shop/orders', 'orders'], ['/admin/shop/leads', 'orders'], ['/admin/elevation-summit', 'registrations'],
  ['/admin/summit-donations', 'donations'], ['/admin/summit-payments', 'donations'], ['/admin/summit-stream', 'livestream'], ['/admin/summit', 'livestream'],
  ['/admin/blog', 'blog'], ['/admin/marketing-pages', 'pages'], ['/admin/newsletter', 'newsletter'], ['/admin/billboards', 'billboards'],
  ['/admin/partners', 'partners'], ['/admin/careers', 'careers'], ['/admin/events', 'events'], ['/admin/intel', 'intel'], ['/admin/master', 'intel'],
  ['/admin/reports', 'reports'], ['/admin/surveys', 'surveys'], ['/admin/logs', 'audit'], ['/admin/demo', 'platform'], ['/admin/inbox', 'platform'],
  ['/admin/about', 'pages'], ['/admin/community', 'chats'], ['/admin/experts', 'pathways'],
];
/** The area an older admin URL belongs to, or null (console pages, Overview, unknown pages). */
export function legacyAreaFor(pathname: string | null): string | null {
  if (!pathname) return null;
  const hit = LEGACY.find(([p]) => pathname === p || pathname.startsWith(p + '/'));
  return hit ? hit[1] : null;
}
