// lib/admin/screens/intel.ts
// Spec copied from the admin prototype (Insights · Platform intel). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "intel",
  group: "Insights",
  title: "Platform intel",
  sub: "AI summaries of how the platform is doing. Run one, or ask your own question.",
  cols: [
    "Analysis",
    "Covers",
    "Last run",
    "Status"
  ],
  statusCol: 3,
  actions: [
    {
      id: "run-analysis",
      label: "Run analysis",
      done: "Analysis ready. Open it to read the summary.",
      keep: true
    }
  ],
  quick: 0,
  ask: true
};

const screen: ScreenModule = {
  spec,
  async load() {
    return { rows: [], note: 'This screen is not connected to data yet.' };
  },
};

export default screen;
