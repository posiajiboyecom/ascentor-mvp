// Lets any screen open the Sage panel on a topic without importing the panel itself.
export type SageTopic = 'plan' | 'lesson' | 'missed' | 'reframe' | 'report' | 'silent' | 'crisis';
export interface SageOpenDetail { topic?: SageTopic; draft?: Record<string, string> }

export function openSage(detail: SageOpenDetail = {}) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<SageOpenDetail>('rx:sage', { detail }));
}
