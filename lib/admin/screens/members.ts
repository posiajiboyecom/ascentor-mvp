// lib/admin/screens/members.ts
// Spec copied from the admin prototype (People · Members). The loader below is a placeholder until it reads real data.
// Prototype KPI tiles to compute for real: Members (sample "1,248"); Paying (sample "412"); On trial (sample "196"); Light access (sample "23")
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "members",
  group: "People",
  title: "Members",
  sub: "Everyone on Ascentor. Open a member to change their stage, plan or messaging.",
  cols: [
    "Member",
    "Email",
    "Stage",
    "Plan",
    "Status",
    "City",
    "Circle",
    "Joined"
  ],
  statusCol: 4,
  actions: [
    {
      id: "make-leader",
      label: "Make Leader",
      col: 2,
      to: "Leader",
      admin: true,
      done: "Now a Leader. Their plan is free while they facilitate."
    },
    {
      id: "extend-trial-7-days",
      label: "Extend trial 7 days",
      col: 4,
      to: "Trial",
      admin: true
    },
    {
      id: "block-messaging",
      label: "Block messaging",
      col: 4,
      to: "Messaging blocked",
      confirm: "They can still read, but can’t send messages until you restore it."
    },
    {
      id: "restore",
      label: "Restore",
      col: 4,
      to: "Active",
      when: "Messaging blocked"
    },
    {
      id: "delete-account",
      label: "Delete account",
      col: 4,
      to: "Removed by admin",
      admin: true,
      danger: true,
      confirm: "This permanently deletes the account and personal data. It can’t be undone."
    }
  ],
  buttons: [
    {
      id: "export-csv",
      label: "Export CSV",
      needs: "full"
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
