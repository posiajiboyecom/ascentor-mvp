import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';
import PushBootstrap from '@/components/rx/PushBootstrap';
import type { Metadata } from 'next';

// Private area: never indexed, even if a URL leaks.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider><PushBootstrap />{children}</ToastProvider>;
}
