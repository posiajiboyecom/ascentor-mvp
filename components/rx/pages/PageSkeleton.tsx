import { Page, Skel } from '@/components/rx/ui';

/** Instant loading state for the member pages: title, a toolbar line and two content blocks. */
export default function PageSkeleton({ aside = true }: { aside?: boolean }) {
  return (
    <Page>
      <div aria-busy="true" aria-live="polite" className="rx-stack">
        <Skel w={220} h={40} />
        <div className={aside ? 'rx-two' : undefined}>
          <div className="rx-stack">
            <Skel h={48} />
            <Skel h={120} />
            <Skel h={120} />
          </div>
          {aside && <div className="rx-stack"><Skel h={160} /></div>}
        </div>
      </div>
    </Page>
  );
}
