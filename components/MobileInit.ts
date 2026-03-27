'use client';
import { useEffect } from 'react';

export function MobileInit() {
  useEffect(() => {
    import('@/lib/mobile-push').then(m => m.initMobilePush());
  }, []);
  return null;
}