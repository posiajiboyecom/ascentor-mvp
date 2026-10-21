// lib/admin/screens/matching.ts
// Spec copied from the admin prototype (Circles · Waiting for a Circle). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "matching",
  group: "Circles",
  title: "Waiting for a Circle",
  sub: "New members waiting to be placed. Match by stage, goal and weekly times.",
  cols: [
    "Member",
    "Stage",
    "Goal",
    "Weekly times",
    "Waiting since",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "place-in-circle-25",
      label: "Place in Circle 25",
      col: 5,
      to: "Matched",
      when: "Waiting",
      done: "Placed in Port Harcourt · Circle 25. They can chat now."
    },
    {
      id: "place-in-circle-33",
      label: "Place in Circle 33",
      col: 5,
      to: "Matched",
      when: "Waiting"
    }
  ],
  quick: 0,
  buttons: [
    {
      id: "auto-match-all",
      label: "Auto-match all"
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
