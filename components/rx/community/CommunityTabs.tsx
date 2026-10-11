import Link from 'next/link';

export default function CommunityTabs({ active }: { active: 'feed' | 'groups' | 'wins' }) {
  return (
    <div className="rx-opts" style={{ marginBottom: 20 }} role="tablist" aria-label="Community">
      <Link href="/community" role="tab" aria-selected={active === 'feed'} className={`rx-opt${active === 'feed' ? ' on' : ''}`}>Feed</Link>
      <Link href="/community/groups" role="tab" aria-selected={active === 'groups'} className={`rx-opt${active === 'groups' ? ' on' : ''}`}>Groups</Link>
      <Link href="/community?category=Wins" role="tab" aria-selected={active === 'wins'} className={`rx-opt${active === 'wins' ? ' on' : ''}`}>Wins board</Link>
    </div>
  );
}
