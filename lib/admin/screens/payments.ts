// lib/admin/screens/payments.ts
// Spec copied from the admin prototype (Revenue · Payments). The loader below is a placeholder until it reads real data.
// Prototype KPI tiles to compute for real: Paid this month (sample "₦[TOTAL]"); Failed (sample "3"); Abandoned checkouts (sample "11"); Refunds (sample "1")
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "payments",
  group: "Revenue",
  title: "Payments",
  sub: "Every Paystack charge: subscriptions, Summit tickets and shop orders.",
  cols: [
    "Reference",
    "Member",
    "Type",
    "Amount",
    "Status",
    "Date"
  ],
  statusCol: 4,
  actions: [
    {
      id: "retry-charge",
      label: "Retry charge",
      col: 4,
      to: "Paid",
      when: "Failed",
      done: "Charge retried and paid."
    },
    {
      id: "refund",
      label: "Refund",
      col: 4,
      to: "Refunded",
      when: "Paid",
      admin: true,
      danger: true,
      confirm: "Refund this payment through Paystack? The member gets an email."
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
