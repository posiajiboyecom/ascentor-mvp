import { redirect } from 'next/navigation';

// /admin/summit-payments is the old, payment-first name for this page from
// when the Summit was ticketed. Registration is free now (donations are the
// only paid flow, tracked separately on /admin/summit-donations), so the
// canonical page moved to /admin/elevation-summit/registrations. Kept as a
// redirect so old links and bookmarks still land somewhere.
export default function SummitPaymentsRedirect() {
  redirect('/admin/elevation-summit/registrations');
}
