// lib/admin/screens/reports.ts
// Spec copied from the admin prototype (Insights · Reports). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "reports",
  group: "Insights",
  title: "Reports",
  sub: "Downloadable reports for the team and partners.",
  cols: [
    "Report",
    "Range",
    "Last generated",
    "Status"
  ],
  statusCol: 3,
  actions: [
    {
      id: "generate",
      label: "Generate",
      col: 3,
      to: "Ready"
    },
    {
      id: "export",
      label: "Export",
      when: "Ready",
      admin: true,
      done: "Export ready to download.",
      keep: true
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
