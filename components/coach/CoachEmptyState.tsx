'use client';

// components/coach/CoachEmptyState.tsx
//
// FIX: Added example starter prompts that pre-fill the input on click.
// Previously the empty state showed session type cards but gave users
// no nudge for what to actually type — a blank input with no examples
// creates hesitation, especially for first-time users.
//
// Each session type maps to 3 rotating example prompts. Clicking one
// calls onSelectType to activate that session, then onPromptSelect to
// pre-fill the input. The active session type's prompts are shown below
// the type grid as tappable chips.
//
// Also fixed: stale --color-* token references → canonical tokens.

import { useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  RefreshCcw,
  MessageSquare,
  CheckSquare,
  Compass,
  DollarSign,
  Users,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import type { SessionType } from '@/lib/session-types';

const ICON_MAP: Record<string, LucideIcon> = {
  challenge_navigation:  AlertTriangle,
  weekly_reflection:     RefreshCcw,
  difficult_conversation: MessageSquare,
  accountability_check:  CheckSquare,
  career_planning:       Compass,
  salary_negotiation:    DollarSign,
  leadership_development: Users,
};

// Example starter prompts per session type — displayed as tappable chips
// beneath the type grid when that type is active.
const EXAMPLE_PROMPTS: Record<string, string[]> = {
  challenge_navigation: [
    "I'm being overlooked for promotion despite strong results — how do I address it?",
    "My manager micromanages everything. How do I create more autonomy?",
    "I need to push back on an unrealistic deadline without damaging the relationship.",
  ],
  weekly_reflection: [
    "This week felt scattered. Help me find what actually moved the needle.",
    "I hit a goal I've been working toward for months — let's unpack what made it work.",
    "I'm going into next week with low energy. Help me refocus.",
  ],
  difficult_conversation: [
    "I need to tell my team their performance isn't meeting expectations.",
    "I want to ask my boss for a raise but I don't know how to open that conversation.",
    "A colleague takes credit for my work in meetings. I need to address it.",
  ],
  accountability_check: [
    "I committed to completing my project proposal last week and didn't. Let's dig into why.",
    "I had three wins this week I want to document before I forget them.",
    "I keep pushing the same task to tomorrow — help me break the pattern.",
  ],
  career_planning: [
    "I want to move from individual contributor to a leadership role in 18 months.",
    "I'm considering a lateral move to a different industry — help me think it through.",
    "I feel stuck in my current role but don't know what the right next step is.",
  ],
  salary_negotiation: [
    "I have a competing offer and want to use it to negotiate with my current employer.",
    "I haven't had a raise in two years. How do I build the case for one?",
    "My new offer is lower than expected. How do I counter without losing the offer?",
  ],
  leadership_development: [
    "My team respects me but I don't feel like they're bought into the vision.",
    "I struggle to have direct conversations — I soften feedback too much.",
    "I'm managing someone older and more experienced than me. How do I lead with authority?",
  ],
};

interface CoachEmptyStateProps {
  allTypes: SessionType[];
  availableTypeIds: Set<string>;
  onSelectType: (id: string) => void;
  onPromptSelect?: (prompt: string) => void;
  greeting: string;
  firstName: string;
}

export function CoachEmptyState({
  allTypes,
  availableTypeIds,
  onSelectType,
  onPromptSelect,
  greeting,
  firstName,
}: CoachEmptyStateProps) {
  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);

  function handleTypeSelect(id: string) {
    setActiveTypeId(id);
    onSelectType(id);
  }

  function handlePromptClick(prompt: string) {
    if (onPromptSelect) onPromptSelect(prompt);
  }

  const activePrompts = activeTypeId ? (EXAMPLE_PROMPTS[activeTypeId] ?? []) : [];

  return (
    <div className="flex flex-col items-center text-center px-5 py-7 lg:py-16 lg:max-w-[640px] lg:mx-auto">
      <span className="flex h-[52px] w-[52px] lg:h-16 lg:w-16 items-center justify-center rounded-full bg-[#C8A96E]/[0.12] border-[1.5px] border-[#C8A96E]/30 mb-3 lg:mb-5">
        <Sparkles className="w-[22px] h-[22px] lg:w-7 lg:h-7 text-[#C8A96E]" aria-hidden="true" />
      </span>

      <h1 className="text-sm lg:text-2xl font-medium text-[var(--text)] mb-1 lg:mb-2 lg:font-serif">
        {greeting}, {firstName}.
      </h1>
      <p className="text-xs lg:text-base text-[var(--text-muted)] leading-relaxed mb-4 lg:mb-8 max-w-[280px] lg:max-w-md">
        Pick a starting point below, or just type what's on your mind.
      </p>

      {/* Session type cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[7px] lg:gap-4 w-full mb-4 lg:mb-6">
        {allTypes.map((type) => {
          const Icon = ICON_MAP[type.id] ?? Sparkles;
          const locked = !availableTypeIds.has(type.id);
          const isActive = activeTypeId === type.id;
          return (
            <button
              key={type.id}
              type="button"
              disabled={locked}
              onClick={() => !locked && handleTypeSelect(type.id)}
              className={`
                flex items-start gap-2.5 lg:gap-4 text-left
                rounded-[10px] lg:rounded-2xl
                border-[0.5px]
                px-3 py-2.5 lg:px-6 lg:py-5
                transition-colors
                ${locked
                  ? 'opacity-50 cursor-not-allowed border-[var(--border)] bg-[var(--bg)]'
                  : isActive
                    ? 'border-[#C8A96E]/50 bg-[#C8A96E]/[0.07]'
                    : 'border-[var(--border)] bg-[var(--bg)] lg:bg-[var(--bg-card)] hover:border-[#C8A96E]/40'
                }
              `}
            >
              <Icon
                className="w-4 h-4 lg:w-6 lg:h-6 text-[var(--text-muted)] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="block text-xs lg:text-base font-medium text-[var(--text)]">
                    {type.label}
                  </span>
                  {locked && (
                    <Lock className="w-3 h-3 text-[var(--text-muted)]" aria-hidden="true" />
                  )}
                </span>
                <span className="block text-[11px] lg:text-sm text-[var(--text-muted)] leading-snug mt-0.5">
                  {type.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Example prompts — appear when a type is selected */}
      {activePrompts.length > 0 && (
        <div className="w-full text-left">
          <p className="text-[10px] lg:text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2 lg:mb-3">
            Try asking Sage…
          </p>
          <div className="flex flex-col gap-1.5 lg:gap-2">
            {activePrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handlePromptClick(prompt)}
                className="
                  text-left text-xs lg:text-sm text-[var(--text)]
                  bg-[var(--bg)] lg:bg-[var(--bg-card)]
                  border-[0.5px] border-[var(--border)]
                  hover:border-[#C8A96E]/40 hover:bg-[#C8A96E]/[0.04]
                  rounded-xl lg:rounded-2xl px-3.5 py-2.5 lg:px-5 lg:py-3.5
                  leading-snug transition-colors
                "
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
