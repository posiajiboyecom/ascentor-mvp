// types/coach.ts
// ============================================================
// Shared shapes between the Coach client UI and the
// /api/coach/session route. These describe the structure
// persisted into coaching_sessions.messages (jsonb array).
// ============================================================

/** A user-authored turn. */
export interface CoachUserMessage {
  role: 'user';
  content: string;
  createdAt: string;
}

/**
 * An assistant turn. `content` mirrors the human-readable text shown
 * in the bubble (currently `question`) so anything that reads
 * messages[].content as a flat string (e.g. coaching-summary.ts's
 * trigger job) still works without modification. The structured
 * reflection/question/action breakdown is preserved alongside it.
 */
export interface CoachAssistantMessage {
  role: 'assistant';
  content: string;
  reflection: string;
  question: string;
  action: string | null;
  createdAt: string;
}

export type CoachMessage = CoachUserMessage | CoachAssistantMessage;

export interface SendCoachMessageRequest {
  sessionId: string | null;
  sessionTypeId: string;
  message: string;
}

export interface SendCoachMessageResponse {
  sessionId: string;
  message: CoachAssistantMessage;
}
