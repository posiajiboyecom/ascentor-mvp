// lib/admin/screens/groups.ts
// Spec copied from the admin prototype (Community · Groups). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "groups",
  group: "Community",
  title: "Groups",
  sub: "Interest groups. Quiet groups (under 5 posts in 7 days) can be merged or archived.",
  cols: [
    "Group",
    "Members",
    "Posts, 7 days",
    "Last active",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "archive",
      label: "Archive",
      col: 4,
      to: "Archived",
      confirm: "Members keep their messages and get a note pointing to the nearest active group."
    },
    {
      id: "mark-active",
      label: "Mark active",
      col: 4,
      to: "Active"
    }
  ],
  buttons: [
    {
      id: "group-suggestions",
      label: "Group suggestions"
    },
    {
      id: "create-group",
      label: "Create group"
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
