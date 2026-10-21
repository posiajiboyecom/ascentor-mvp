// lib/admin/screens/surveys.ts
// Spec copied from the admin prototype (Insights · Surveys). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "surveys",
  group: "Insights",
  title: "Surveys",
  sub: "The baseline survey at signup and follow-ups at 3 and 6 months.",
  cols: [
    "Survey",
    "Responses",
    "Average time",
    "Willing to pay",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "close",
      label: "Close",
      col: 4,
      to: "Ended"
    },
    {
      id: "reopen",
      label: "Reopen",
      col: 4,
      to: "Live"
    }
  ],
  buttons: [
    {
      id: "new-survey",
      label: "New survey"
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
