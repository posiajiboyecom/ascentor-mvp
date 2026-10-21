// lib/admin/screens/meetups.ts
// Spec copied from the admin prototype (Community · Meetups). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "meetups",
  group: "Community",
  title: "Meetups",
  sub: "Member-organised meetups. New ones need approval before they show.",
  cols: [
    "Meetup",
    "City",
    "Host",
    "Date",
    "Going",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "approve",
      label: "Approve",
      col: 5,
      to: "Approved",
      when: "Pending"
    },
    {
      id: "remove",
      label: "Remove",
      col: 5,
      to: "Removed by admin",
      confirm: "The host and anyone going get a message."
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
