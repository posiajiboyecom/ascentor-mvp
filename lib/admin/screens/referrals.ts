// lib/admin/screens/referrals.ts
// Spec copied from the admin prototype (Revenue · Referrals). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "referrals",
  group: "Revenue",
  title: "Referrals",
  sub: "When a friend subscribes after their trial, both get 7 extra days.",
  cols: [
    "Member",
    "Friend",
    "Joined",
    "Subscribed",
    "Reward",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "approve-reward",
      label: "Approve reward",
      col: 5,
      to: "Rewarded"
    },
    {
      id: "flag-as-abuse",
      label: "Flag as abuse",
      col: 5,
      to: "Flagged"
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
