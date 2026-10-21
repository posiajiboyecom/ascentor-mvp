// lib/admin/screens/promos.ts
// Spec copied from the admin prototype (Revenue · Promo codes). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "promos",
  group: "Revenue",
  title: "Promo codes",
  sub: "Discounts for campaigns and partners.",
  cols: [
    "Code",
    "Discount",
    "Applies to",
    "Used",
    "Expires",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "pause",
      label: "Pause",
      col: 5,
      to: "Paused"
    },
    {
      id: "activate",
      label: "Activate",
      col: 5,
      to: "Active"
    }
  ],
  buttons: [
    {
      id: "new-code",
      label: "New code"
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
