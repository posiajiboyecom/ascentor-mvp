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


## Second pass (handoff v0.2 and the founder's decisions)

Apply `database/migrations/20261008c_member_profile_upsert_fix.sql` if you have not, then
`database/migrations/20261009_reimagine_v2.sql`. Both are additive and idempotent. The second one also moves the
survey tables to private storage and drops `growth_scores` (copied first).

```bash
npx tsx scripts/apply-migration.ts database/migrations/20261009_reimagine_v2.sql --yes
```

### What changed

- **Circle size and matching:** 8 members. Placement needs the same language and a shared stage or time slot, then prefers
  both, then the nearest time zone. Otherwise a new Circle opens. Meetings and the 90-day cycle start at 6.
- **Mentorship is Model A:** the Circle is recommended up to three mentors (fit to the Circle as a group), members vote
  within 5 days, the highest vote becomes the Circle's mentor (a tie goes to the facilitator for 2 days, then best fit).
  The mentor accepts or declines (a decline reopens the vote). The Circle marks the times it can attend from the mentor's
  open slots, and the facilitator or mentor confirms a time that 6 or more can attend. Sessions are 20 minutes, every two
  weeks, audio only. A session runs only if 6 or more are going the day before, otherwise the series moves and the Circle
  picks again. Each member can send one question per session. The Circle keeps one agreement (up to 3 goals, tasks with an
  owner), and a task is done only when its owner and the mentor both confirm. One free swap after the first session.
  Mentors see the agreement, questions, first names and aggregated Circle facts, never the chat, reports or survey answers.
- **Audio calls on Daily:** `lib/rx/calls.ts`, `/api/rx/call/*`, `/call/[circleId]`, `/call/[circleId]/mentor`. Weekly Circle
  call is 15 minutes. Set `DAILY_API_KEY` in Vercel. Without it members see "The call isn't working right now" and the
  admin Circles page says so. Rooms are private, audio only, nothing is recorded, and tokens end at the scheduled time.
  Minutes per room are logged, with a notice on the admin page at 80% of Daily's 10,000 free minutes.
  **Test before launch:** the room-level `permissions` property (the code falls back safely if Daily rejects it), latency
  from Lagos, and microphone access inside WhatsApp and Instagram browsers.
- **Chat access for admins:** `/admin/chats` (admins only) lists Circle chats, group rooms, direct messages, Sage
  conversations and a per-member view, with a date range, and downloads any of them as a PDF or text file. Every view and
  download is written to `chat_access_log` and shown at `/admin/chats/log`. Members consent at signup (a required checkbox)
  and existing members see a one-time notice on Today. The privacy policy, the Circle pledge and the signup text say so.
  Sage conversations are now stored (`sage_conversations`, `sage_messages`).
- **Survey answers are private:** they live in `private_survey_responses` and `private_growth_scores`, which no client and
  no admin screen can read. Only server code reads them, always for one member. The survey is now 10 questions.
- **Messaging safety:** new accounts cannot message outside their Circle until onboarding is done and 7 days have passed.
  A first message from an account under 30 days old cannot contain links, phone numbers or a hand-off to another app.
  Anyone may send at most 5 new requests a day. Payment, investment, romance and security-code patterns are flagged to the
  moderation queue (`/admin/moderation`) wherever they appear. Staff can turn messaging off for one member.
- **Sage:** named just "Sage", with an S mark that breathes (stops for reduced motion). The panel keeps a one-line note
  that Sage is an AI. On phones the floating button shows on Today and Learn only; on desktop Sage is also in the top bar.
- **Smaller:** all four plan blanks are required (3 to 140 characters), check-ins take an optional note, the missed-day
  message offers a Sage question, Announcements shows a dot not a number, the mobile menu has "This week", Settings has a
  time zone and a blocked-members list with unblock, onboarding follows the handoff order, 12 lessons (one per week),
  group suggestions need about 20 interested members (`GROUP_SUGGESTION_MIN`), new admin screens say "desktop only" on phones.

### Not done yet

- Dark mode (deliberately postponed).
- The Google and Apple welcome screen (sign-in stays on the existing login page).
- An on-call person and alert for the Sage crisis protocol. The card shows 112 only.
- Real Daily test (needs your Daily account), and a verified mental-health helpline for the safety card.
