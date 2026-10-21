// Switched off from Admin > Platform settings: send visitors home instead of showing the page.
import { redirect } from 'next/navigation';
import { asBool, getSetting } from '@/lib/admin/settings';

export default async function FeatureGate({ children }: { children: React.ReactNode }) {
  if (!asBool(await getSetting('feature.cities'))) redirect('/dashboard');
  return children;
}
