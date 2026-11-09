// lib/admin/owner.ts
// Server-only. The Owner account: one specific email, set only in the OWNER_EMAIL environment variable (never in a
// database row or admin screen), that always gets full access everywhere — admin console and member app — and is
// the only account that can grant or change anyone else's staff role. Nothing in the admin UI can change who this
// is: rotating it means changing the environment variable and redeploying, not clicking a button.
//
// The Owner's profiles.role is also 'admin', so every database policy and older admin screen that checks for an admin
// lets this account through. What sets it apart lives here: only the Owner can grant or change staff access (Team and
// access, /api/admin/users change_role, /api/admin/permissions), and nobody else can change, ban or delete this account.
//
// Members never see staff roles: Circle and Group membership comes from actual seats, so the Owner is not counted in
// or listed on any Circle or Group unless they join one like anyone else.

import 'server-only';

export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner;
}
