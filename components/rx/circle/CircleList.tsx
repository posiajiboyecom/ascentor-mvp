'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { joinCircle, leaveCircle, placeMeInCircle } from '@/app/(app)/circle/actions';
import { useToast } from '@/components/rx/Toast';

export function JoinCircleButton({ circleId, label = 'Join' }: { circleId: string; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => start(async () => {
      const r = await joinCircle(circleId);
      toast(r.ok ? `You joined ${r.name}.` : r.error);
      if (r.ok) router.push(`/circle?c=${circleId}`); else router.refresh();
    })}>{pending ? 'Joining…' : label}</button>
  );
}

export function LeaveCircleButton({ circleId, name }: { circleId: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) return <button type="button" className="rx-link muted" style={{ minHeight: 36, fontSize: 14 }} onClick={() => setConfirm(true)}>Leave</button>;
  return (
    <span className="rx-row" style={{ gap: 8 }}>
      <span className="rx-sm">Leave {name}?</span>
      <button type="button" className="rx-link" style={{ minHeight: 36, fontSize: 14 }} disabled={pending} onClick={() => start(async () => { const r = await leaveCircle(circleId); toast(r.ok ? 'You left the Circle.' : r.error); setConfirm(false); router.refresh(); })}>Yes, leave</button>
      <button type="button" className="rx-link muted" style={{ minHeight: 36, fontSize: 14 }} onClick={() => setConfirm(false)}>Stay</button>
    </span>
  );
}

export function PlaceMeCard() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
      const r = await placeMeInCircle();
      toast(r.ok ? 'You’re in a Circle.' : r.error);
      router.refresh();
    })}>{pending ? 'Placing you…' : 'Place me in a Circle'}</button>
  );
}
