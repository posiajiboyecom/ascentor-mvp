import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
