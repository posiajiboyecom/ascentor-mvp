// lib/admin/screens/events.ts
// Spec copied from the admin prototype (Marketing · Public events). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "events",
  group: "Marketing",
  title: "Public events",
  sub: "Events anyone can register for on the website.",
  cols: [
    "Event",
    "Date",
    "City",
    "Registrations",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "publish",
      label: "Publish",
      col: 4,
      to: "Live"
    },
    {
      id: "close-registration",
      label: "Close registration",
      col: 4,
      to: "Ended"
    }
  ],
  buttons: [
    {
      id: "new-event",
      label: "New event"
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
