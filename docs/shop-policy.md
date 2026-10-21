# Shop policy wording

All shop policy text lives in [`lib/shop-policy.ts`](../lib/shop-policy.ts): the returns and size-swap policy
(`RETURNS_POLICY`) and the delivery notes. Components import from there, so final wording is a one-file change.

**The returns policy is pending legal review.** Until the final wording is supplied, `RETURNS_POLICY` holds the
literal placeholder `[RETURNS POLICY]`, which members see on their My orders page. Do not publish the shop to the
public with the placeholder. To finish: replace the string in `lib/shop-policy.ts` (use `\n\n` between paragraphs)
and redeploy.

Delivery times (Lagos 2 to 4 working days, rest of Nigeria 5 to 7, Summit pickup at the merch desk) are the ones in
the app prototype and are also confirmed in the receipt email (`lib/shopEmails.ts`).
