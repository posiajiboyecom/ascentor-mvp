// lib/admin/screens/newsletter.ts
// Spec copied from the admin prototype (Marketing · Newsletter). The loader below is a placeholder until it reads real data.
// Prototype KPI tiles to compute for real: Subscribers (sample "[COUNT]"); Open rate (sample "—"); Next issue (sample "Tue 20 Oct"); Unsubscribes (sample "—")
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "newsletter",
  group: "Marketing",
  title: "Newsletter",
  sub: "The Ascentor Weekly. People sign up on the landing page, not in the app.",
  cols: [
    "Issue",
    "Subject",
    "Sent to",
    "Opened",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "send-now",
      label: "Send now",
      col: 4,
      to: "Sent",
      admin: true,
      confirm: "Send this issue to every subscriber now?"
    },
    {
      id: "schedule-for-tuesday",
      label: "Schedule for Tuesday",
      col: 4,
      to: "Scheduled"
    }
  ],
  buttons: [
    {
      id: "new-issue",
      label: "New issue"
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
