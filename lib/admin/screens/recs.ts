// lib/admin/screens/recs.ts
// Recommendations is a bespoke page (app/admin/c/recs). This module exists only so the menu badge can ask for the open count.
import 'server-only';
import { openRecommendationCount } from '@/lib/admin/recommendations';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: 'recs', group: 'Overview', title: 'Recommendations', sub: 'What members are asking for, worked out from real member signals.',
  cols: [], statusCol: -1, actions: [],
};

const screen: ScreenModule = {
  spec,
  async load() { return { rows: [] }; },
  badge: openRecommendationCount,
};

export default screen;
