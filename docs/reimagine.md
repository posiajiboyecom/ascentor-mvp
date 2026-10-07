# The reimagined member app

Built from the Claude Design prototype (`design/reimagine/Main.dc.html`, kept in the repo for reference). The prototype's
structure, screens and copy are implemented in full; the **styling is the app's own** (light theme, Metropolis, gold
accent, dark primary buttons), via `styles/rx.css` and the existing `--app-*` tokens.

## Before it works: apply the migration

`database/migrations/20261008_reimagine.sql` creates every new table. Until it is applied the new screens load but show
empty states. It is additive and idempotent. A dry run (rolled back) passes against the live database.

```bash
npx tsx scripts/dry-run-migration.ts database/migrations/20261008_reimagine.sql --probe <probe.sql>   # optional, rolls back
npx tsx scripts/apply-migration.ts   database/migrations/20261008_reimagine.sql --yes
```

## Screens

| Area | Routes |
|---|---|
| Onboarding (12 steps, saved as you go) | `/onboarding` |
| Today (plan builder, check-in, announcement banner) | `/dashboard` |
| Learn (pathway, explore, lesson with practice) | `/learn`, `/learn/lesson/[slug]`; old catalogue at `/learn/courses` |
| Circle (pledge, home, chat, reports, meeting, review, facilitator) | `/circle`, `/circle/{chat,reports,meeting,review,facilitator}` |
| Community (feed, wins board, groups, rooms) | `/community`, `/community/groups`, `/community/groups/[slug]`; old channels at `/community/channels` |
| Messages (inbox, requests, conversation, profile card) | `/messages` |
| Sessions (mentor intake, suggestions, profile, times, active mentorship, mentor view) | `/sessions/**` |
| Sage panel, what Sage knows, reminders | floating orb, `/sage/memory`, `/sage/reminders` |
| My Growth, Profile, Settings | `/growth`, `/profile`, `/settings` |
| Announcements | `/announcements` |
| Admin | `/admin/groups`, `/admin/announcements`, `/admin/circles`, `/admin/human-mentors` |

## How things work

- **Circles** hold 6 to 8 members. `rx_assign_circle()` places a member at the end of onboarding (same language, nearest
  time zone first). The 6th member starts the 90-day cycle. Facilitators are members an admin flags in `/admin/circles`.
- **Mentors** are people (`human_mentors`), separate from the AI coach personas in `mentor_profiles`. Add them in
  `/admin/human-mentors`; they add open times from the mentor view under Sessions.
- **Sage** (`/api/rx/sage`) is grounded in the member's goal, plan and notes, never stores conversations, and routes
  self-harm language to a fixed safety message without calling the model. Notes it saves appear under What Sage knows.
- **Privacy:** a facilitator sees only whether and when a member checked in, never what they wrote. Survey answers and
  Sage conversations never feed group suggestions.
- **Daily job** (`/api/cron/daily`) also starts and ends announcements, sends one practice nudge a day (respecting
  reminder settings and quiet hours) and tells a facilitator when a member has had no check-in for 5 days.

## Content and settings still needed from you

- Lesson **videos**: lessons are seeded with short written versions and a "video coming soon" state. Add `video_url`
  (YouTube or direct mp4) in `rx_lessons` to switch a lesson to video.
- A **verified mental-health helpline** for the "Hard topics" card. It currently shows the emergency number 112 only.
- At least one **facilitator** and one **mentor** (admin pages above), otherwise Circles have no facilitator and
  Sessions shows "no mentors yet".
