// lib/admin/screens/billboards.ts
// Spec copied from the admin prototype (Marketing · Billboards). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "billboards",
  group: "Marketing",
  title: "Billboards",
  sub: "Promo cards in the app’s side rail, up to three slots.",
  cols: [
    "Title",
    "Slot",
    "Colour",
    "Button",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "publish",
      label: "Publish",
      col: 4,
      to: "Live"
    },
    {
      id: "take-down",
      label: "Take down",
      col: 4,
      to: "Draft"
    }
  ],
  buttons: [
    {
      id: "new-billboard",
      label: "New billboard"
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
