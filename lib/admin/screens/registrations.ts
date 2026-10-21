// lib/admin/screens/registrations.ts
// Spec copied from the admin prototype (Elevation Summit · Registrations). The loader below is a placeholder until it reads real data.
// Prototype KPI tiles to compute for real: Registered (sample "[COUNT]"); Confirmed (sample "[COUNT]"); Physical (sample "[COUNT]"); Virtual (sample "[COUNT]")
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "registrations",
  group: "Elevation Summit",
  title: "Registrations",
  sub: "Thursday 19 November 2026 · Aderemi Makanjuola Hall, LASU, and online.",
  cols: [
    "Person",
    "Email",
    "Ticket",
    "Registered",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "confirm-registration",
      label: "Confirm registration",
      col: 4,
      to: "Confirmed",
      when: "Not confirmed"
    },
    {
      id: "resend-ticket",
      label: "Resend ticket",
      when: "Confirmed",
      done: "Ticket sent again.",
      keep: true
    }
  ],
  quick: 0,
  buttons: [
    {
      id: "email-everyone-not-yet-confirmed",
      label: "Email everyone not yet confirmed"
    },
    {
      id: "export-list",
      label: "Export list",
      needs: "full"
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
