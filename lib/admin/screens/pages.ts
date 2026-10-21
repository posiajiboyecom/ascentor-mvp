// lib/admin/screens/pages.ts
// Spec copied from the admin prototype (Marketing · Landing pages). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "pages",
  group: "Marketing",
  title: "Landing pages",
  sub: "Pages on the public website.",
  cols: [
    "Page",
    "Path",
    "Owner",
    "Status",
    "Updated"
  ],
  statusCol: 3,
  actions: [
    {
      id: "publish",
      label: "Publish",
      col: 3,
      to: "Published"
    },
    {
      id: "unpublish",
      label: "Unpublish",
      col: 3,
      to: "Draft"
    }
  ],
  buttons: [
    {
      id: "new-page",
      label: "New page"
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
