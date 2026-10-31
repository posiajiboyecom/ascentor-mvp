import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';
import PushBootstrap from '@/components/rx/PushBootstrap';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider><PushBootstrap />{children}</ToastProvider>;
}
