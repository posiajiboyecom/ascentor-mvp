import { permanentRedirect } from 'next/navigation';

export default async function ProductRedirect({ params }: { params: Promise<{ id: string }> }) {
  permanentRedirect(`/shop/${encodeURIComponent((await params).id)}`);
}
