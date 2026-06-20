'use client';

// components/coach/ChatMessage.tsx
import { Sparkles, Target } from 'lucide-react';
import type { CoachMessage } from '@/types/coach';

interface ChatMessageProps {
  message: CoachMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="
            max-w-[80%] rounded-[12px_2px_12px_12px]
            bg-[#0F0F0E] text-[#FAFAF8]
            px-[11px] py-2 lg:px-5 lg:py-3
            text-xs lg:text-base leading-relaxed
          "
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 lg:gap-3">
      <span
        className="
          flex h-[26px] w-[26px] lg:h-10 lg:w-10 shrink-0 items-center justify-center
          rounded-full bg-[#C8A96E]/[0.12] border-[0.5px] border-[#C8A96E]/30
        "
      >
        <Sparkles className="w-[11px] h-[11px] lg:w-[18px] lg:h-[18px] text-[#C8A96E]" aria-hidden="true" />
      </span>

      <div className="max-w-[85%] flex flex-col gap-1.5 lg:gap-3">
        {message.reflection && (
          <p className="font-serif italic text-xs lg:text-lg text-[var(--color-text-secondary)] leading-relaxed">
            {message.reflection}
          </p>
        )}

        {message.question && (
          <div
            className="
              rounded-[2px_12px_12px_12px]
              bg-[var(--color-background-secondary)]
              border-[0.5px] border-[var(--color-border-tertiary)]
              px-[11px] py-2 lg:px-6 lg:py-4
              text-xs lg:text-lg leading-relaxed
              text-[var(--color-text-primary)]
            "
          >
            {message.question}
          </div>
        )}

        {message.action && (
          <div
            className="
              rounded-lg lg:rounded-xl
              bg-[#C8A96E]/[0.07] border-[0.5px] border-[#C8A96E]/20
              px-[10px] py-2 lg:px-5 lg:py-4
              flex gap-2 lg:gap-3
            "
          >
            <Target className="hidden lg:block w-5 h-5 text-[#C8A96E] shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[11px] lg:text-base leading-relaxed text-[#A8894E]">
              <span className="hidden lg:inline text-[10px] font-medium uppercase tracking-[0.08em] text-[#C8A96E] block mb-1">
                This week&apos;s action
              </span>
              <span className="lg:hidden font-medium text-[#C8A96E]">
                Commitment suggestion:{' '}
              </span>
              {message.action}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
