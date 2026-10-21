// lib/admin/screens/blog.ts
// Spec copied from the admin prototype (Marketing · Blog). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "blog",
  group: "Marketing",
  title: "Blog",
  sub: "Articles on joinascentor.com.",
  cols: [
    "Title",
    "Author",
    "Views",
    "Status",
    "Updated"
  ],
  statusCol: 3,
  actions: [
    {
      id: "publish",
      label: "Publish",
      col: 3,
      to: "Published",
      admin: true
    },
    {
      id: "unpublish",
      label: "Unpublish",
      col: 3,
      to: "Draft",
      admin: true
    }
  ],
  buttons: [
    {
      id: "new-post",
      label: "New post"
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
