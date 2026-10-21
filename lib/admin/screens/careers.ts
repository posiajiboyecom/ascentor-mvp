// lib/admin/screens/careers.ts
// Spec copied from the admin prototype (Marketing · Careers). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "careers",
  group: "Marketing",
  title: "Careers",
  sub: "Roles at Ascentor.",
  cols: [
    "Role",
    "Team",
    "Applicants",
    "Status"
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
      id: "close",
      label: "Close",
      col: 3,
      to: "Ended"
    }
  ],
  buttons: [
    {
      id: "new-role",
      label: "New role"
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
