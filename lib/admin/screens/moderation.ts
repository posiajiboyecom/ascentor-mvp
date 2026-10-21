// lib/admin/screens/moderation.ts
// Spec copied from the admin prototype (Community · Moderation). The loader below is a placeholder until it reads real data.
// Prototype developer note: Matches resolveItem, removeContent and setMessagingBlocked in app/admin/moderation/actions.ts.
// Prototype KPI tiles to compute for real: Open reports (sample "4"); Resolved this week (sample "19"); Messaging blocked (sample "2"); Average time to act (sample "3 h")
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "moderation",
  group: "Community",
  title: "Moderation",
  sub: "Reports from members. Remove content, dismiss, or block someone from messaging.",
  cols: [
    "Reported item",
    "Type",
    "Reported by",
    "Reason",
    "When",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "remove-content",
      label: "Remove content",
      col: 5,
      to: "Removed by admin",
      when: "Open",
      confirm: "The content is hidden for everyone. The author is told why."
    },
    {
      id: "block-messaging",
      label: "Block messaging",
      col: 5,
      to: "Messaging blocked",
      when: "Open",
      confirm: "The author can read, but can’t send messages until you restore it."
    },
    {
      id: "dismiss",
      label: "Dismiss",
      col: 5,
      to: "Resolved",
      when: "Open"
    }
  ],
  quick: 2
};

const screen: ScreenModule = {
  spec,
  async load() {
    return { rows: [], note: 'This screen is not connected to data yet.' };
  },
};

export default screen;
