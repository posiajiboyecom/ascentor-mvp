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


## Third pass: Community feed, many Circles, notifications, demo Circles

Migration: `database/migrations/20261010_community_circles.sql` (additive and idempotent). Apply it **before** merging this branch.

```bash
npx tsx scripts/apply-migration.ts database/migrations/20261010_community_circles.sql --yes
```

Then create the demo Circles (optional, for testing) and deploy:

```bash
npx tsx scripts/seed-demo.ts            # create demo Circles, mentors and members
npx tsx scripts/seed-demo.ts --again    # rebuild them
npx tsx scripts/seed-demo.ts --reset    # remove all demo data
```

### The bug behind "Circle shows Community"

`next.config.ts` had a legacy redirect `/circle -> /community`. It sent every tap on the Circle tab to Community. It is removed.
That one line is the only change needed to make the existing Circle screens reachable on `main`.

### Community

- One living feed at `/community`. No tabs, no side panel. Groups stay in the menu.
- **Categories replace dimensions.** A member picks one category when posting. Admins manage the list at `/admin/categories`
  (add, rename, hide). Renaming moves existing posts with it.
- **Rich text** (Tiptap) with bold, italic, underline, heading, lists, quote and links. The server never trusts the HTML:
  `lib/rx/richtext.ts` cleans it to an allow-list before it is stored, and a plain-text copy is kept for search and previews.
- **Photos and video** (up to 4 per post). Files go straight from the browser to the `rx-posts` bucket through a signed upload link
  (`/api/rx/upload-url`), so large videos do not pass through the app server. Photos up to 8 MB, video up to 30 MB. The bucket
  enforces the types and size.
- **Reactions** (Like, Support, Insightful), **threaded comments** (one level of replies), **sharing** (copy link, send to one of your
  Circles, send to someone you already talk to, or the phone's share sheet). Share links open `/community/post/<id>`.
- **Safety:** the same scam filters apply to posts and comments and feed the moderation queue. In an account's first 7 days posts
  and comments cannot contain links, phone numbers or hand-offs to other apps. Limits: 10 posts and 30 comments an hour. Members
  can report a post or comment. Staff can delete either.
- Seven starter posts from the Ascentor team are created by the migration so the feed is never empty.

### Circles

- A member can sit in up to **three Circles**: a **home Circle** (placed automatically on language, stage and time slot, as before)
  and **interest Circles** (joined on purpose). The database rule "one member seat per person" is gone. Seats are capped at 8 with
  a row lock, so two people cannot take the last seat together (`rx_join_circle`).
- `/circle` lists your Circles with plain-language state ("5 of 8 joined, meetings start at 6", "Vote open, closes in 4 days",
  "Your mentor is Adaeze") and **Find a Circle** (open seats, ranked by your interests). `/circle?c=<id>` is one Circle.
- Every Circle has its own chat, reports, review, call, mentor vote, times and agreement. Anything that used to assume "your Circle"
  now takes the Circle from `?c=` and falls back to the home Circle. Messages lists one chat per Circle.
- `lib/rx/circle-state.ts` writes the state in words and is unit tested.

### Notifications

- `rxNotify()` in `lib/rx/notifications.ts` is the one way to notify: an in-app row (the bell in the header), push, and email.
  Settings has switches for Circle updates, comments, replies and shares, reactions, and one email switch each for Circle and Community.
- Events: you joined a Circle, a new member joined (and "your Circle now has 6"), a vote opened, your vote is in, a winner was chosen
  (with congratulations), a mentor was chosen (the mentor is emailed), a mentor said yes or no, sessions were booked, a call is
  tomorrow, a session was moved, and Community comments, replies, reactions and shares.
- Reactions never email. Repeats fold into one row. Email limits: ten minutes between emails about the same thing, eight a day.
- Demo members never receive anything.
- **Emails may land in spam until the joinascentor.com sender domain is verified** with the email provider. `DEFAULT_FROM` in
  `lib/nodemailer.ts` still defaults to the old domain unless `EMAIL_FROM` is set. Set `EMAIL_FROM` in Vercel.

### Demo Circles and the Demo lab

`scripts/seed-demo.ts` (or the button at `/admin/demo`) creates five interest Circles at different stages with seats held open:

| Circle | Seats | State |
|---|---|---|
| Cybersecurity | 5 of 8 | Not started. Joining makes 6 and starts the cycle. |
| AI and technology | 6 of 8 | A mentor vote is open, 4 of 6 have voted. |
| Money and business | 6 of 8 | A mentor said yes. Times are being picked. |
| Faith and purpose | 7 of 8 | A mentor is active, sessions booked, an agreement, and a call window open. |
| Careers | 3 of 8 | Just forming. |

`/admin/demo` has buttons to move each Circle forward: open a vote, have demo members vote, close it (announces the winner), mentor
says yes, book the best time, open the call for 30 minutes, add a demo member. Demo Circles and mentors are flagged `is_demo`: they
are shown to staff only, never recommended to real Circles, ignored by the RSVP rule and reminders, and removed by `--reset`.

### Still to do

- Video toggle on calls (audio stays the default).
- Real calls need `DAILY_API_KEY`.
- Cron-driven vote reminders and a "vote closes tomorrow" nudge.
