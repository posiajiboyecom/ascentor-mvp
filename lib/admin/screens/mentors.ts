// lib/admin/screens/mentors.ts
// Spec copied from the admin prototype (People · Mentors). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "mentors",
  group: "People",
  title: "Mentors",
  sub: "Mentors give their time free. Circles vote for one, then book from their free times.",
  cols: [
    "Mentor",
    "Field",
    "Circles",
    "Sessions this month",
    "Languages",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "approve",
      label: "Approve",
      col: 5,
      to: "Active",
      when: "Pending"
    },
    {
      id: "pause",
      label: "Pause",
      col: 5,
      to: "Paused"
    },
    {
      id: "reject",
      label: "Reject",
      col: 5,
      to: "Rejected",
      when: "Pending",
      confirm: "They’ll get a polite email. You can invite them again later."
    }
  ],
  quick: 0,
  buttons: [
    {
      id: "invite-a-mentor",
      label: "Invite a mentor"
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
