'use client';

// The notice card at the bottom of the right-hand column. UserShell supplies the notice; every <Aside> shows it.

import { createContext, useContext } from 'react';
import NoticeCard from '@/components/rx/NoticeCard';
import type { NoticeData } from '@/lib/rx/notice-types';

const NoticeContext = createContext<NoticeData | null>(null);
export const NoticeProvider = NoticeContext.Provider;

export default function AsideNotice() {
  const notice = useContext(NoticeContext);
  if (!notice) return null;
  return <div className="rx-aside-notice"><NoticeCard notice={notice} /></div>;
}
