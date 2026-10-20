import { Page, Skel } from '@/components/rx/ui';

export default function StoreLoading() {
  return (
    <Page>
      <div aria-busy="true" className="rx-stack">
        <Skel w={160} h={40} />
        <Skel w={420} h={18} />
        <div className="rx-row">{[0, 1, 2, 3].map((i) => <Skel key={i} w={96} h={40} />)}</div>
        <div className="rx-grid3">{[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} h={260} />)}</div>
      </div>
    </Page>
  );
}
