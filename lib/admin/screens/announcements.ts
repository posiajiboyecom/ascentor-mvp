// lib/admin/screens/announcements.ts
// Spec copied from the admin prototype (Community · Announcements). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "announcements",
  group: "Community",
  title: "Announcements",
  sub: "News for members. One can be featured as a banner on Today.",
  cols: [
    "Title",
    "Audience",
    "Banner on Today",
    "Dates",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "publish-now",
      label: "Publish now",
      col: 4,
      to: "Live"
    },
    {
      id: "end",
      label: "End",
      col: 4,
      to: "Ended"
    }
  ],
  buttons: [
    {
      id: "new-announcement",
      label: "New announcement"
    }
  ]
};

const screen: ScreenModule = {
  spec,
  async load() {
    return { rows: [], note: 'This screen is not connected to data yet.' };
  },
};

export default screen;
