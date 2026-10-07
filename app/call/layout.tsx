import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';

// Calls take over the whole screen: no tab bar, no sidebar.
export default function CallLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
