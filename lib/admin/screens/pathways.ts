// lib/admin/screens/pathways.ts
// Spec copied from the admin prototype (Learn · Pathways and lessons). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "pathways",
  group: "Learn",
  title: "Pathways and lessons",
  sub: "12-week pathways. Each lesson ends in a practice members set on Today.",
  cols: [
    "Pathway or lesson",
    "Dimension",
    "Lessons",
    "Enrolled",
    "Completion",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "publish",
      label: "Publish",
      col: 5,
      to: "Published",
      admin: true
    },
    {
      id: "unpublish",
      label: "Unpublish",
      col: 5,
      to: "Draft",
      admin: true
    }
  ],
  buttons: [
    {
      id: "new-lesson",
      label: "New lesson"
    },
    {
      id: "new-pathway",
      label: "New pathway"
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
