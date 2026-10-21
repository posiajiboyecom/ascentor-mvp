// lib/admin/screens/cities.ts
// Spec copied from the admin prototype (Community · City groups). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "cities",
  group: "Community",
  title: "City groups",
  sub: "One chat per city. Members can ask for a new city.",
  cols: [
    "City",
    "Country",
    "Members",
    "Next meetup",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "open-this-city",
      label: "Open this city",
      col: 4,
      to: "Open",
      when: "Requested",
      done: "City group opened. Members who asked get a note."
    },
    {
      id: "pause",
      label: "Pause",
      col: 4,
      to: "Paused"
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
