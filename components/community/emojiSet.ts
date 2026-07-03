// components/community/emojiSet.ts
// ============================================================
// Shared emoji vocabulary for The Circle. Used by both:
//   - EmojiPickerButton (composing a message)
//   - MessageReactionPopover (reacting to a message)
//
// Quick-react row matches what's already visible in the prototype's
// message bubbles (🔥 💯 🙏 ❤️) plus a few common additions. The full
// grid is for the picker button's expanded view.
// ============================================================

export const QUICK_REACTIONS = ['🔥', '❤️', '💯', '🙏', '👏', '😂'] as const;

export const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Frequently used',
    emojis: ['🔥', '❤️', '💯', '🙏', '👏', '😂', '👍', '🎉'],
  },
  {
    label: 'Smileys',
    emojis: ['😀', '😊', '😅', '🤔', '😎', '🥳', '😢', '😮'],
  },
  {
    label: 'Gestures',
    emojis: ['👍', '👏', '🙌', '🤝', '✊', '🙏', '💪', '👋'],
  },
  {
    label: 'Symbols',
    emojis: ['🔥', '💯', '⭐', '🎯', '🏆', '💡', '✅', '🚀'],
  },
];
