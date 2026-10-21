// lib/admin/screens/mentorship.ts
// Spec copied from the admin prototype (Circles · Mentor sessions). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "mentorship",
  group: "Circles",
  title: "Mentor sessions",
  sub: "A session only starts once the Circle’s agenda is ready (goal plus at least 3 questions).",
  cols: [
    "Circle",
    "Mentor",
    "Date",
    "Votes",
    "Agenda",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "nudge-the-circle",
      label: "Nudge the Circle",
      when: "Booked",
      done: "Reminder sent to finish the agenda.",
      keep: true
    },
    {
      id: "cancel-session",
      label: "Cancel session",
      col: 5,
      to: "Cancelled",
      confirm: "The Circle and mentor get a message. They can book again."
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
