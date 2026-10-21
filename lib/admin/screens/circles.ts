// lib/admin/screens/circles.ts
// Spec copied from the admin prototype (Circles · Circles). The loader below is a placeholder until it reads real data.
// Prototype developer note: Matches setFacilitator, assignFacilitator and updateCircleMeeting in app/admin/circles/actions.ts.
// Prototype KPI tiles to compute for real: Circles running (sample "52"); Average attendance (sample "78%"); Need a facilitator (sample "2"); Low quorum (sample "3")
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "circles",
  group: "Circles",
  title: "Circles",
  sub: "Each Circle runs a 90-day cycle. Calls start when 60% of members have joined.",
  cols: [
    "Circle",
    "Facilitator",
    "Members",
    "Week",
    "Meeting",
    "Attendance",
    "Health"
  ],
  statusCol: 6,
  actions: [
    {
      id: "assign-facilitator",
      label: "Assign facilitator",
      col: 1,
      to: "Ngozi Obi",
      when: "Needs facilitator",
      done: "Ngozi Obi is now the facilitator. She’ll get an email."
    },
    {
      id: "mark-healthy",
      label: "Mark healthy",
      col: 6,
      to: "Healthy"
    },
    {
      id: "move-meeting-to-thu-7-00-pm",
      label: "Move meeting to Thu 7:00 PM",
      col: 4,
      to: "Thu 7:00 PM"
    }
  ],
  quick: 0,
  buttons: [
    {
      id: "new-circle",
      label: "New Circle"
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
