// lib/admin/screens/donations.ts
// Spec copied from the admin prototype (Elevation Summit · Donations). The loader below is a placeholder until it reads real data.
// Prototype KPI tiles to compute for real: Gross (sample "₦[TOTAL]"); Fees (sample "₦[TOTAL]"); Net (sample "₦[TOTAL]"); Attempts (sample "[COUNT]")
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "donations",
  group: "Elevation Summit",
  title: "Donations",
  sub: "Donations through Paystack, with fees and net.",
  cols: [
    "Donor",
    "Amount",
    "Fees",
    "Net",
    "Status",
    "Date"
  ],
  statusCol: 4,
  actions: [],
  buttons: [
    {
      id: "export",
      label: "Export",
      needs: "full"
    }
  ],
  note: "Real totals live in your finance sheet. Your own spending counts as personal support there, not here."
};

const screen: ScreenModule = {
  spec,
  async load() {
    return { rows: [], note: 'This screen is not connected to data yet.' };
  },
};

export default screen;
