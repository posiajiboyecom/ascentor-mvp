// Lets any screen open the Sage panel on a topic without importing the panel itself.
/** 'open' = Sage opened with no set topic (the floating tab, the top-bar button): Sage introduces itself. */
export type SageTopic = 'open' | 'plan' | 'lesson' | 'missed' | 'reframe' | 'report' | 'silent' | 'crisis';
export interface SageOpenDetail { topic?: SageTopic; draft?: Record<string, string> }

export function openSage(detail: SageOpenDetail = {}) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<SageOpenDetail>('rx:sage', { detail }));
}
