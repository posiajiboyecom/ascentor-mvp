// lib/admin/screens/knowledge.ts
// Spec copied from the admin prototype (Learn · Sage knowledge base). The loader below is a placeholder until it reads real data.
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "knowledge",
  group: "Learn",
  title: "Sage knowledge base",
  sub: "Sources Sage can draw on. Add PDFs, links, YouTube talks or text.",
  cols: [
    "Source",
    "Type",
    "Topic",
    "Chunks",
    "Added",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "re-index",
      label: "Re-index",
      col: 5,
      to: "Processing"
    },
    {
      id: "remove",
      label: "Remove",
      col: 5,
      to: "Removed by admin",
      confirm: "Sage stops using this source straight away."
    }
  ],
  buttons: [
    {
      id: "upload-pdf",
      label: "Upload PDF"
    },
    {
      id: "add-link",
      label: "Add link"
    },
    {
      id: "add-youtube",
      label: "Add YouTube"
    },
    {
      id: "add-text",
      label: "Add text"
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
