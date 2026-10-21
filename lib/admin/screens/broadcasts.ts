// lib/admin/screens/broadcasts.ts
// Spec copied from the admin prototype (Community · Broadcasts). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "broadcasts",
  group: "Community",
  title: "Broadcasts",
  sub: "Email, push and in-app messages to groups of members.",
  cols: [
    "Message",
    "Channel",
    "Audience",
    "Sent",
    "Opened",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "send-now",
      label: "Send now",
      col: 5,
      to: "Sent",
      confirm: "This goes to everyone in the audience straight away."
    },
    {
      id: "pause",
      label: "Pause",
      col: 5,
      to: "Paused"
    }
  ],
  buttons: [
    {
      id: "new-broadcast",
      label: "New broadcast"
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
