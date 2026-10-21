// lib/shop-policy.ts
// Shop policy wording, in ONE place, so final text can be dropped in without touching any component.
//
// RETURNS_POLICY is a PLACEHOLDER until the legal officer supplies the final wording. Replace the string (keep it a
// short paragraph; use "\n\n" between paragraphs) and redeploy. Until then members see the bracketed placeholder.
// Delivery times below are the ones in the app prototype.

export const RETURNS_POLICY = '[RETURNS POLICY]';

export const DELIVERY_NOTE = 'Lagos in 2 to 4 working days. Rest of Nigeria in 5 to 7. Summit pickups are at the merch desk.';

/** Shorter note for the public shop, where digital items are also sold. */
export const DELIVERY_NOTE_SHORT = 'Lagos in 2 to 4 working days. Rest of Nigeria in 5 to 7. Digital items arrive by email.';

export const RETURNS_HEADING = 'Returns and size swaps';
