// lib/admin/screens/livestream.ts
// Spec copied from the admin prototype (Elevation Summit · Livestream). The loader below is a placeholder until it reads real data.
// Prototype KPI tiles to compute for real: Stream status (sample "Not live"); Links sent (sample "0"); Reminder (sample "Not sent"); Opened (sample "—")
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "livestream",
  group: "Elevation Summit",
  title: "Livestream",
  sub: "Send access links to virtual attendees and check the stream before going live.",
  cols: [
    "Person",
    "Email",
    "Ticket",
    "Opened",
    "Link"
  ],
  statusCol: 4,
  actions: [
    {
      id: "send-link",
      label: "Send link",
      col: 4,
      to: "Sent"
    }
  ],
  quick: 0,
  buttons: [
    {
      id: "send-all-access-links",
      label: "Send all access links"
    },
    {
      id: "test-stream",
      label: "Test stream"
    }
  ],
  note: "Before you go live: keep the stream unlisted, not public, so only registrants can watch."
};

const screen: ScreenModule = {
  spec,
  async load() {
    return { rows: [], note: 'This screen is not connected to data yet.' };
  },
};

export default screen;
