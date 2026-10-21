// Client-safe constants for the Conversations screen (tabs and export choices), copied from the admin prototype.

export type TabKey = 'sage' | 'dm' | 'circle' | 'group' | 'agenda' | 'posts' | 'member';

export const TABS: { key: TabKey; label: string; kind: string; cols: string[] }[] = [
  { key: 'sage', label: 'Sage chats', kind: 'Sage · AI coach', cols: ['Conversation', 'Member', 'Messages', 'Last topic'] },
  { key: 'dm', label: 'Direct messages', kind: 'Direct message', cols: ['Conversation', 'People', 'Messages', 'Last message'] },
  { key: 'circle', label: 'Circle chats', kind: 'Circle chat', cols: ['Circle', 'Members', 'Messages', 'Last message'] },
  { key: 'group', label: 'Group chats', kind: 'Group chat', cols: ['Group', 'Members', 'Messages', 'Last message'] },
  { key: 'agenda', label: 'Session agendas', kind: 'Mentor session agenda', cols: ['Agenda', 'Circle', 'Questions', 'Status'] },
  { key: 'posts', label: 'Posts and replies', kind: 'Community post', cols: ['Post', 'Author', 'Replies', 'Type'] },
  { key: 'member', label: 'By member', kind: 'Everything from one member', cols: ['Member', 'Sage', 'Chats', 'Posts'] },
];

export const FORMATS = ['CSV', 'Excel (.xlsx)', 'JSON', 'PDF', 'Word (.docx)', 'Markdown', 'Plain text', 'HTML', 'ZIP (every format)'] as const;
export type FormatLabel = (typeof FORMATS)[number];
export const RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'All time'] as const;
export type RangeLabel = (typeof RANGES)[number];

/** What an export covers. 'one' is the open conversation, 'members' is everything from its members, 'tab' is the whole tab. */
export type ScopeKind = 'one' | 'members' | 'tab' | 'everything' | 'sage' | 'dm' | 'circlegroup' | 'posts' | 'agenda';

export interface ExportRequest {
  scope: ScopeKind;
  tab?: TabKey;
  id?: string;
  title: string;
  scopeLabel: string;
  format: FormatLabel;
  range: RangeLabel;
  attach: boolean;
  meta: boolean;
  anon: boolean;
}

export const EXPORT_ROW_CAP = 20000;
