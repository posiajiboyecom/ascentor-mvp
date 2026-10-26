// lib/admin/types.ts
// The contract between a console screen and the generic list screen. A screen is a small module (lib/admin/screens/<area>.ts):
// a static spec (what the table looks like and which actions exist), a loader (the rows, from the real database) and
// action handlers (what happens when a button is pressed). The server checks the access level BEFORE any of it runs.

import type { Level } from '@/lib/admin/areas';

export interface StaffCtx {
  userId: string;
  name: string;
  email: string | null;
  /** The teammate's role id and display name (the real role, never the "view as" preview). */
  roleId: string;
  roleName: string;
  /** Level for an area, from the real role. */
  level: (area: string) => Level;
  /** Throws a friendly Error if the level is below `need`. Call at the top of every action. */
  require: (area: string, need: Level) => void;
}

export interface Kpi { label: string; value: string; note?: string }

export interface ActionSpec {
  id: string;
  label: string;
  /** Column index this action changes, and the status it moves the row to. Used for the "already there" check and the row preview. */
  col?: number;
  to?: string;
  /** Only offered while the row's status column equals this. */
  when?: string | string[];
  /** Needs 'full' (export, delete, refund). Otherwise 'edit'. */
  admin?: boolean;
  danger?: boolean;
  /** If set, the screen asks first with this text. */
  confirm?: string;
  /** Toast shown after success (the handler's own message wins). */
  done?: string;
  /** The action does not change a status; it is always offered (when/admin still apply). */
  keep?: boolean;
}

export interface ButtonSpec {
  id: string;
  label: string;
  /** 'full' for exports and anything that deletes; default 'edit'. */
  needs?: Level;
  /** Navigates instead of running a handler (for example to an existing editor). */
  href?: string;
}

export interface ScreenSpec {
  area: string;
  group: string;
  title: string;
  sub: string;
  cols: string[];
  /** Index of the status column (shows as a coloured tag and drives the filter chips). -1 for none. */
  statusCol: number;
  actions: ActionSpec[];
  /** Index into `actions` of the one-click button shown on each row. */
  quick?: number;
  buttons?: ButtonSpec[];
  note?: string;
  /** Show the "Ask a question about the platform" box (Platform intel). */
  ask?: boolean;
}

/** Extra grouped facts shown in a row's detail drawer, under small headings. Optional: screens without it are unaffected. */
export interface DetailGroup { heading: string; items: [string, string][] }
export interface RowContact { name?: string | null; phone?: string | null; email?: string | null }
export interface RowData { id: string; cells: string[]; details?: DetailGroup[]; contact?: RowContact }

export interface ScreenData {
  rows: RowData[];
  kpis?: Kpi[];
  /** Replaces the spec note when set (for example "Showing the 200 newest"). */
  note?: string;
}

export interface ActionResult { ok: boolean; message?: string; error?: string; /** Replace the row's cells (full row) after success. */ cells?: string[]; /** Ask the browser to download this file. */ download?: { filename: string; mime: string; content: string }; /** Ask the browser to reload the screen. */ refresh?: boolean }

export interface ScreenModule {
  spec: ScreenSpec;
  load: (ctx: StaffCtx) => Promise<ScreenData>;
  /** Row actions. Return { ok:false, error } for a refusal; throw only for bugs. */
  act?: (ctx: StaffCtx, actionId: string, rowId: string, row: string[]) => Promise<ActionResult>;
  /** Header buttons (Export, New ..., Send all ...). */
  button?: (ctx: StaffCtx, buttonId: string) => Promise<ActionResult>;
  /** Optional count shown as a badge on the menu item (for example open reports). Keep it to ONE cheap count query. */
  badge?: () => Promise<number>;
}
