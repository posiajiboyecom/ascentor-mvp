# Leader invites

Leaders lead for free while they facilitate a Circle: no payment and no card. The Leader plan is never purchasable at checkout (hidden in checkout and Settings > Plan, and `/api/pay/start` refuses `leader`). Plan prices are not touched here.

## Three ways to get Leader access

1. An admin marked them Leader (Members > Make Leader, `member_profile.is_facilitator`).
2. They accepted a Leader invite (sets `is_facilitator` and `profiles.leader_free = true`).
3. Onboarding placed them at the Leading stage (`member_profile.stage = 'Leading'`).

The pure rule is `leaderEligible()` in `lib/leader-invite-core.ts`; `hasFreeLeaderAccess()` in `lib/leader-access.ts` reads it from the database for any screen that needs to know.

## Inviting a Leader

Admin: Members > Invite a Leader (`/admin/c/members/leaders`, needs Edit on Members). Enter name and email.

- The link is `/facilitator/<token>`. `/leader-invite/<token>` redirects to it. The older static `/leader-invite` page still loads.
- The token is 32 random bytes; only its SHA-256 hash is stored in `leader_invites`.
- One link per person, tied to their email (compared in lower case), single use, valid 14 days, revocable.
- The invitee gets an email and, if an account with that email exists, an in-app notification.
- If the email fails, the invite still exists and the admin is told to share the link. The link is shown once after creating or resending, because it cannot be recovered from the hash.
- Resend (sent or expired invites) makes a new token and expiry; the old link stops working. Revoke only applies to invites still waiting.
- The table records who was invited, by whom, when it was sent, and when and by whom it was used.

## Accepting

The visitor sees who invited them and what a Leader does, signs in (or creates an account, with no card) using the invited email, and presses Accept and continue. The invite is marked used atomically, the member gets the Leader flag and `leader_free`, and sees "Welcome, you now lead for free while you facilitate a Circle". A different email shows a mismatch message. Expired, revoked and used links show a message and a Contact us button.

## Database

`database/migrations/20261025b_leader_invites.sql` creates `leader_invites` (additive, RLS on, service role only) and adds `profiles.leader_free boolean not null default false`. Until it is applied, the admin page and invite links say the feature is not set up, and acceptance fails safely.
