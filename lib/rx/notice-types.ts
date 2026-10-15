// lib/rx/notice-types.ts
// The data a NoticeCard shows. Client-safe, so server code and components share it.

export interface NoticeData {
  /** Stable id. Used to remember that a member dismissed this card. */
  id: string;
  source: 'broadcast' | 'announcement';
  title: string;
  /** One short line under the title: a date and place, or the first words of the message. */
  line: string;
  href: string | null;
  actionLabel: string | null;
}
