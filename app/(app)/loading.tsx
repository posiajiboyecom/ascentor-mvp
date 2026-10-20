// Shown the instant a member taps any page without its own loading.tsx: the shell (sidebar, header) stays put
// and this skeleton fills the content area while the page's data loads, so a tap is never answered with a blank.
import { Page, Skel } from '@/components/rx/ui';

export default function AppLoading() {
  return (
    <Page>
      <div aria-busy="true" aria-live="polite" className="rx-stack">
        <Skel w={200} h={40} />
        <Skel w={360} h={16} />
        <div className="rx-grid2">
          <Skel h={180} />
          <Skel h={180} />
        </div>
        <Skel h={240} />
      </div>
    </Page>
  );
}
