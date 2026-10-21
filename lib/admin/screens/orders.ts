// lib/admin/screens/orders.ts
// Spec copied from the admin prototype (Revenue · Shop orders). The loader below is a placeholder until it reads real data.
// Prototype KPI tiles to compute for real: To pack (sample "2"); Shipped (sample "1"); Summit pickups (sample "17"); Refunds (sample "0")
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "orders",
  group: "Revenue",
  title: "Shop orders",
  sub: "Pack, ship and track orders. Summit pickups are collected at the merch desk.",
  cols: [
    "Order",
    "Member",
    "Items",
    "Delivery",
    "Total",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "mark-packed",
      label: "Mark packed",
      col: 5,
      to: "Packing",
      when: "Paid"
    },
    {
      id: "mark-shipped",
      label: "Mark shipped",
      col: 5,
      to: "Shipped",
      when: "Packing"
    },
    {
      id: "mark-delivered",
      label: "Mark delivered",
      col: 5,
      to: "Delivered",
      when: "Shipped"
    },
    {
      id: "refund",
      label: "Refund",
      col: 5,
      to: "Refunded",
      admin: true,
      danger: true,
      confirm: "Refund this order through Paystack?"
    }
  ],
  quick: 1,
  buttons: [
    {
      id: "summit-pickup-list",
      label: "Summit pickup list"
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
