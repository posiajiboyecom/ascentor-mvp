// lib/admin/screens/categories.ts
// Spec copied from the admin prototype (Community · Post categories). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "categories",
  group: "Community",
  title: "Post categories",
  sub: "Categories members tag posts with. Matches app/admin/categories.",
  cols: [
    "Category",
    "Dimension",
    "Posts",
    "Status"
  ],
  statusCol: 3,
  actions: [
    {
      id: "hide",
      label: "Hide",
      col: 3,
      to: "Hidden"
    },
    {
      id: "show",
      label: "Show",
      col: 3,
      to: "Active"
    }
  ],
  buttons: [
    {
      id: "add-category",
      label: "Add category"
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
