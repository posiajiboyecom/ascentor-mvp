'use client';

import { Sparkles } from 'lucide-react';
import { openSage } from '@/components/rx/sage-bus';

export function SageSuggest() {
  return (
    <button type="button" className="rx-btn secondary" onClick={() => openSage({ topic: 'plan' })}>
      <Sparkles aria-hidden style={{ width: 16, height: 16 }} />Suggest a question
    </button>
  );
}
