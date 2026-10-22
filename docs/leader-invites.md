# Leader invites

Leader is a paid plan (price from `lib/plans-config.ts`, `PLAN_LEADER_PRICE_NGN`). It is never free. Not everyone can choose it.

## Two ways in

A member can see and buy the Leader plan if any of these is true:

1. The team marked them Leader (Members > Make Leader) or they accepted a Leader invite. Both set `member_profile.is_facilitator`.
2. Onboarding placed them at the Leading stage (`member_profile.stage = 'Leading'`).
3. They already hold the Leader plan (or the legacy Climber plan).

The rule is `leaderEligible()` in `lib/leader-invite-core.ts`, applied by `canChooseLeader()` in `lib/leader-access.ts`. That one function is used by checkout, Settings > Plan and the `/api/pay/start` 403, so the check is server-enforced.

## Inviting a Leader

Admin: Members > Invite a Leader (`/admin/c/members/leaders`, needs Edit on Members). Enter name and email.

- The link is `/leader-invite/<token>`. The token is 32 random bytes; only its SHA-256 hash is stored in `leader_invites`.
- One link per person, tied to their email (compared in lower case), single use, valid 14 days, revocable.
- The invitee gets an email (subject "You are invited to lead with Ascentor") and, if an account with that email exists, an in-app notification.
- If the email fails, the invite still exists and the admin is told to share the link. The link is shown once after creating or resending, because it cannot be recovered from the hash.
- Resend (sent or expired invites) makes a new token and expiry; the old link stops working. Revoke only applies to invites still waiting.

## Accepting

The visitor sees who invited them, what a Leader does, and the price. They sign in (or create an account) with the invited email and press Accept and continue. The invite is marked used atomically, the member is flagged Leader, and they go to checkout for the Leader plan. A different email shows a mismatch message. Expired, revoked and used links show a message and a Contact us button.

The older static `/leader-invite` page still works and still sends people to checkout, where the same eligibility rule applies.

## Database

`database/migrations/20261025b_leader_invites.sql` creates `leader_invites` (additive, RLS on, service role only). Until it is applied the admin page and invite links say the feature is not set up.
