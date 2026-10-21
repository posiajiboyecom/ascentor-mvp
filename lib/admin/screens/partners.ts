// lib/admin/screens/partners.ts
// Spec copied from the admin prototype (Marketing · Partners). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "partners",
  group: "Marketing",
  title: "Partners",
  sub: "Organisations with their own Ascentor space and a revenue share.",
  cols: [
    "Partner",
    "Type",
    "Members",
    "Revenue share",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "approve",
      label: "Approve",
      col: 4,
      to: "Active"
    },
    {
      id: "suspend",
      label: "Suspend",
      col: 4,
      to: "Suspended",
      confirm: "Their members keep access until the end of the month."
    },
    {
      id: "reject",
      label: "Reject",
      col: 4,
      to: "Rejected"
    }
  ],
  quick: 0
};

const screen: ScreenModule = {
  spec,
  async load() {
    return { rows: [], note: 'This screen is not connected to data yet.' };
  },
};

export default screen;
