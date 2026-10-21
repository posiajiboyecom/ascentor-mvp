// lib/admin/screens/products.ts
// Spec copied from the admin prototype (Revenue · Shop products). The loader below is a placeholder until it reads real data.
// Prototype developer note: Prices and products are sample data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "products",
  group: "Revenue",
  title: "Shop products",
  sub: "Merch, journals and digital products in the member shop.",
  cols: [
    "Product",
    "Category",
    "Price",
    "Stock",
    "Sold",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "publish",
      label: "Publish",
      col: 5,
      to: "Published"
    },
    {
      id: "mark-out-of-stock",
      label: "Mark out of stock",
      col: 5,
      to: "Out of stock"
    },
    {
      id: "hide",
      label: "Hide",
      col: 5,
      to: "Draft"
    }
  ],
  buttons: [
    {
      id: "new-product",
      label: "New product"
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
