// lib/rx/chat-types.ts
// Message shape shared by every chat surface (Circle, Groups, direct messages, mentor thread).

export interface ChatMsg {
  id: string;
  userId: string | null;
  name: string;
  avatarUrl?: string | null;
  body: string;
  createdAt: string;
  isWin?: boolean;
  pinned?: boolean;
}

export interface RealtimeSpec { table: string; column: string; value: string }
