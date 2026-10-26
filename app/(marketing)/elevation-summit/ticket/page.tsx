import type { Metadata } from 'next';
import TicketClient from './TicketClient';

export const metadata: Metadata = {
  title: 'Find my ticket: The Elevation Summit',
  description: 'Open your Elevation Summit ticket without waiting for an email.',
  robots: { index: false, follow: false },
};

export default function TicketPage() {
  return <TicketClient />;
}
