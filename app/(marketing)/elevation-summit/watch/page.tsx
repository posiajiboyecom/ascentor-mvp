import type { Metadata } from 'next';
import WatchClient from './WatchClient';

export const metadata: Metadata = {
  title: 'Watch: The Elevation Summit',
  description: 'Livestream access for confirmed virtual attendees of The Elevation Summit.',
  robots: { index: false, follow: false },
};

export default function WatchPage() {
  return <WatchClient />;
}
