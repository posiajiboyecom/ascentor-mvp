# Ascentor Wiki

## Table of Contents

1. [Platform Architecture](#platform-architecture)
2. [Core Features](#core-features)
3. [User Journeys](#user-journeys)
4. [The Total Person Framework](#the-total-person-framework)
5. [Sage AI Coach](#sage-ai-coach)
6. [The Circle Community](#the-circle-community)
7. [The Elevation Summit](#the-elevation-summit)
8. [Partner Program](#partner-program)
9. [Admin & Moderation](#admin--moderation)
10. [API Reference](#api-reference)
11. [Database Schema](#database-schema)
12. [Deployment Architecture](#deployment-architecture)
13. [Payments & Checkout](#payments--checkout)
14. [Dashboard Shell & Search](#dashboard-shell--search)
15. [Engineering Log](#engineering-log)

---

## Platform Architecture

Ascentor is built on a modern, scalable stack optimized for real-time coaching, community features, and content delivery.

### High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js 16    │────│   Supabase      │────│   PostgreSQL    │
│   (App Router)  │     │   (Auth + DB)   │     │   + RLS         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │                       │                       │
         v                       v                       v
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel Edge   │     │   Anthropic     │     │   Paystack/     │
│   (CDN + SSR)   │     │   Claude API    │     │   Selar         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Key Architectural Decisions

1. **Server/Client Split**: Server components fetch CMS data and handle auth; client components manage interactivity
2. **Row-Level Security**: All database access is scoped to the authenticated user via RLS policies
3. **Edge-First**: Static pages are pre-rendered; dynamic content is fetched client-side or via server components
4. **Progressive Web App**: Installable on mobile with offline support via service workers

---

## Core Features

### 1. Sage AI Coach

Sage is an AI mentor built on Anthropic's Claude API. It provides structured coaching sessions across four types:

| Session Type | Purpose |
|-------------|---------|
| Navigate a Challenge | Work through a specific problem or decision |
| Prep a Conversation | Role-play and prepare for important conversations |
| Weekly Reflection | Review progress and set intentions |
| Accountability Check | Commit to actions and report back |

**Technical Notes:**
- Each session type uses a distinct system prompt
- Conversations are stored in Supabase for history and continuity
- Inputs are sent to Anthropic's Claude Sonnet model
- Coaching data is NOT used to train AI models

### 2. The Circle Community

Accountability Circles are small, curated peer groups for professional growth.

**Features:**
- Curated matching based on career stage and goals
- Daily check-ins and prompts
- Upvote and discussion system
- Expert-led sessions within circles
- Push notifications for engagement

**Moderation:**
- Community Guidelines enforced via RLS
- Reporting system for harmful content
- Admin moderation tools

### 3. The Elevation Summit

The annual flagship event of the Ascentor movement.

**2026 Summit:**
- Date: 19 November, 2026
- Location: Lagos, Nigeria
- Theme: "The Rise We Choose. The Elevation Story."
- Tracks: Leadership, Legacy, Community, Vocation

**Platform Integration:**
- Registration via `/elevation-summit#register`
- Speaker applications via `/elevation-summit#speak`
- Partner/sponsorship via `/elevation-summit#partner`

### 4. Learning Library

Expert-led courses and content for continuous development.

**Content Types:**
- Video courses with progress tracking
- downloadable resources (salary scripts, promotion playbook)
- Expert session recordings
- Reading lists and frameworks

**Access Control:**
- Free tier: limited access
- Pro tier: full library access
- Premium tier: exclusive content + coaching

---

## User Journeys

### New User Journey

```
Landing Page → Sign Up → Onboarding → Dashboard
                                    ├── Sage AI Coach
                                    ├── The Circle
                                    ├── Learning Library
                                    └── Expert Sessions
```

### Partner Journey

```
Partner Application → Review → Onboarding
                                    ├── Brand Customization
                                    ├── Member Management
                                    ├── Revenue Dashboard
                                    └── Event Management
```

### Admin Journey

```
Admin Login → Dashboard
                    ├── User Management
                    ├── Content Management
                    ├── Coaching Oversight
                    ├── Community Moderation
                    └── Partner Management
```

---

## The Total Person Framework

Ascentor is built around six dimensions of human development:

```
┌─────────────────────────────────────────────────────────────┐
│                    THE TOTAL PERSON                          │
├────────────┬────────────┬────────────┬────────────┬────────────┬────────────┤
│    MIND    │ CHARACTER  │ VOCATION   │RELATIONSHIPS│ COMMUNITY  │  LEGACY   │
│            │            │            │              │            │           │
│ Think      │ Live       │ Work       │ Lead         │ Build      │ What       │
│independently│principled │purposefully│others        │beyond self │remains     │
│critically  │whole       │impact      │as partner,   │civic       │when you're │
│            │            │            │parent, friend│duty        │gone        │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
```

Every feature, conversation, and resource is oriented toward developing all six dimensions.

---

## Sage AI Coach

### System Architecture

```
User Input → Supabase → Next.js API → Anthropic Claude
                                                    │
                                                    v
                                          Structured Response
                                                    │
                                                    v
                                          Supabase Storage
                                                    │
                                                    v
                                          User Session History
```

### Session Types

Each session type has a unique system prompt designed to produce structured, actionable outputs:

1. **Navigate a Challenge**
   - Problem framing
   - Option generation
   - Decision framework

2. **Prep a Conversation**
   - Scenario analysis
   - Key messages
   - Objection handling

3. **Weekly Reflection**
   - Wins and lessons
   - Alignment check
   - Next week priorities

4. **Accountability Check**
   - Commitment review
   - Progress assessment
   - Course correction

---

## The Circle Community

### Circle Structure

```
Circle (8-12 members)
├── Daily Check-in Prompt
├── Member Posts & Replies
├── Upvote System
├── Expert Sessions
└── Notifications
```

### Engagement Mechanics

- **Daily Prompts**: AI-generated questions to spark reflection
- **Check-ins**: Members share progress and challenges
- **Upvotes**: Community-driven content prioritization
- **Expert Sessions**: Scheduled live sessions with mentors

---

## The Elevation Summit

### Event Structure

| Component | Description |
|-----------|-------------|
| Main Stage | Keynotes from global leaders |
| Breakout Sessions | Track-specific deep dives |
| Circle Experience | Community connection activities |
| Legacy Lab | Hands-on impact projects |
| Elevation Ceremony | Recognition and commitment |

### Platform Features

- Registration and ticketing
- Speaker submission system
- Partner/sponsor portal
- Event schedule builder
- Post-event content library

---

## Partner Program

### Partner Tiers

| Tier | Features |
|------|----------|
| Community Partner | Basic brand presence, member referral |
| Summit Partner | Event branding, speaking opportunities |
| Platform Partner | Custom subdomain, branded experience |

### Partner Dashboard Features

- White-label brand customization
- Member management and analytics
- Revenue tracking and payouts
- Event creation and management
- Marketing asset library

---

## Admin & Moderation

### Admin Roles

| Role | Permissions |
|------|-------------|
| Super Admin | Full platform access |
| Content Admin | CMS, blog, events |
| Community Admin | Moderation, circles |
| Partner Admin | Partner management |
| Finance Admin | Payments, subscriptions |

> **In code**, access is a `role` on `profiles` (`admin`, `moderator`, `member`)
> plus optional granular `permissions` (see `lib/permissions.ts`, e.g.
> `users.view`, `payments.view`). The named roles above describe intended
> responsibilities, not separate database roles.

### Admin Access

- Admins use the **same accounts** as members; there is no separate user system.
- Staff sign in at **`/admin-login`** (unlisted, not indexed, not linked publicly).
  This exists because the public `/login` and `/signup` routes are currently
  redirected to the community gate. After sign-in the page checks the role and
  signs out anyone who is not an admin or moderator.
- Unauthenticated visits to `/admin/*` and expired admin sessions (24 h
  inactivity) redirect to `/admin-login`.
- Forgot password uses the standard OTP reset flow; started from `/admin-login`
  it returns there afterwards.
- `app/admin/layout.tsx` enforces the role server-side; API routes enforce
  role/permissions again (defence in depth).

### Admin Dashboard

- **Overview:** KPI strip (total users, active subscribers, estimated MRR,
  30-day revenue, checkout completion, AI sessions) and Recharts graphs
  (revenue, subscriber mix, signups vs sessions, checkout funnel). Data comes
  from `GET /api/admin/analytics`, computed server-side. Revenue figures require
  `payments.view`. MRR excludes promo and admin-granted plans.
- **Summit Registrations** (`/admin/elevation-summit/registrations`): Elevation
  Summit registrations only. Registration is free and has nothing to do with
  Paystack (donations, the one remaining paid flow, are tracked separately at
  **Donations**). Summary cards (total, confirmed, not yet confirmed),
  server-side (AJAX) search, filters by status (confirmed, not confirmed) and
  Physical/Virtual, pagination, an off-canvas per record (call/WhatsApp, email
  status, **resend confirmation + ticket**, **confirm + send ticket**, delete)
  and a branded **PDF report** of the current search and filters.
- **Subscription Payments** (`/admin/payments`): plan checkouts with status
  filters, an off-canvas per attempt, a **Revenue ledger** tab listing every
  paid item behind the revenue figure, deletion of unpaid test attempts, and
  **Reconcile now**. Summit and subscription revenue are always shown as
  separate streams (dashboard cards and colour-coded badges).
- **Summit Livestream** (`/admin/summit-stream`): a live/off toggle (matters
  only on the day itself; before the confirmed start instant the public page
  always shows a countdown regardless) and an optional specific YouTube video
  id (blank = auto-embed whatever is live and Public on
  youtube.com/@AscentorGlobal - a Private stream can never be embedded; use
  Unlisted) for the public gate at `/elevation-summit/watch`; a table of
  confirmed virtual attendees with send/resend of the watch-page link
  (individually or all at once); sending the same email to any inbox; and a
  manual test trigger for the morning-of-event reminder.
- **Checkout switch:** toggles paid access vs free mode
  (`platform_settings.checkout_enabled`).
- Layout, search and navigation are described in
  [Dashboard Shell & Search](#dashboard-shell--search).

### Moderation Tools

- Content reporting system
- User suspension/banning
- Circle moderation
- Automated content filtering
- Audit logging

---

## API Reference

### Key API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/welcome` | POST | Send welcome emails |
| `/api/waitlist` | POST | Join waitlist |
| `/api/events/list` | GET | Fetch public events |
| `/api/experts/register` | POST | Expert application |
| `/api/careers` | GET | Career opportunities |
| `/api/newsletter` | POST | Newsletter signup |
| `/api/usage/check` | GET | Usage limit checking |
| `/api/pay/start` | POST | Start a subscription checkout (records a `payment_attempts` row) |
| `/api/pay/callback` | GET | Paystack redirect; settles the payment |
| `/api/pay/webhook` | POST | Paystack webhook (HMAC-verified; settles `charge.success`) |
| `/api/summit/register` | POST | Create or update a Summit registration |
| `/api/summit/pay/initiate` | POST | Create a Summit payment attempt |
| `/api/summit/pay/verify` | POST | Settle a Summit payment (reference must match the registration) |
| `/api/auth/forgot-password` | POST | Send a password-reset code (uniform response) |
| `/api/auth/reset-password` | POST | Reset a password with a code (attempt-limited) |
| `/api/search` | GET | Member global search (courses, sessions) |
| `/api/admin/search` | GET | Admin global search (permission aware) |
| `/api/admin/analytics` | GET | Overview KPIs and chart series |
| `/api/summit/pay/abandon` | POST | Browser reports a closed payment window; alerts the admin (verifies with Paystack first, once per attempt) |
| `/api/admin/summit-registrations` | GET / POST / PATCH | Summit registrations with derived payment state, server-side search/filter/pagination and stats (`?paged=1`); `verify` and `resend` actions; notes and ticket type |
| `/api/summit/stream/verify` | GET / POST | Public livestream email gate: returns not_found / not_paid / paid (+ stream settings) for an email; sets a convenience cookie so a refresh doesn't require retyping |
| `/api/admin/summit-stream` | GET / POST | Livestream settings (enabled, video id) and confirmed-virtual-attendee list; `send_all` / `send_one` email the watch-page link |
| `/api/admin/payments` | GET / POST / DELETE | Payment health, attempt list, detail and revenue ledger; reconcile, verify, resend; delete test data (admin only, audit-logged; paid attempts are protected) |
| `/api/cron/reconcile-payments` | GET | Daily reconciliation (requires `CRON_SECRET`) |
| `/api/cron/summit-event-day` | GET | Morning-of-event reminder to every confirmed registrant; no-ops on any other day (requires `CRON_SECRET`) |

---

## Database Schema

### Core Tables

```sql
-- User profiles
profiles (id, email, full_name, role, onboarding_completed, ...)

-- Blog content
blog_posts (id, title, slug, content, is_published, ...)

-- Events
events (id, title, slug, event_date, location, ...)

-- Coaching sessions
coaching_sessions (id, user_id, session_type, input, response, ...)

-- Community content
community_posts (id, user_id, circle_id, content, ...)

-- Newsletter
newsletter_subscribers (email, is_active, source, ...)

-- Checkout attempts (subscriptions + Summit tickets), one row per attempt
payment_attempts (id, reference UNIQUE, kind, status, user_id, plan_id, billing,
                  registration_id, email, amount_kobo, currency, provider_tx_id,
                  provider_status, failure_reason, paid_at, abandoned_at,
                  admin_notified_at, recovery_sent_at, created_at, updated_at)
-- status: pending | success | failed | abandoned | duplicate

-- Password reset (codes stored as HMAC hashes)
password_reset_otps (id, email, otp_code, expires_at, used, attempts, created_at)
```

### Row-Level Security

RLS is enabled on the tables covered by the migrations in `database/migrations/`;
the base schema predates them, so confirm RLS on every table in the live
database (see the audit notes in the README).

- `profiles`: members can read and update their own row, but a trigger blocks
  changes to `role`, `permissions`, `subscription_*`, `billing_cycle`,
  `payment_method`, `card_details`, `paystack_*` and `referral_count` for client
  roles. Service-role API routes and admins are unaffected.
- `summit_registrations`: members can read their own row; inserts and deletes
  happen only through the API.
- `payment_attempts`, `password_reset_otps`: no client access (admins can read
  `payment_attempts`); API routes use the service role.

---

## Deployment Architecture

### Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Development | localhost:3000 | Local development |
| Staging | staging.ascentorbi.com | Pre-production testing |
| Production | ascentorbi.com | Live platform |

### CI/CD Pipeline

```
Push to main → Vercel Preview → E2E Tests → Production Deploy
Push to feature → Vercel Preview → Automated Tests → PR Check
```

### Scheduled jobs

`vercel.json` defines two crons (the Hobby maximum): `/api/cron/reconcile-payments`
daily at 07:00 UTC, and `/api/cron/summit-event-day` daily at 06:00 UTC (the
latter no-ops unless today is actually the Summit day in WAT). Vercel Hobby
allows at most two crons, each at most once per day, fired within the
scheduled hour, with a 60 s function limit; both jobs are designed as batch
sweeps for that. They authenticate with `Authorization: Bearer $CRON_SECRET`
and refuse to run if `CRON_SECRET` is not set. Trigger.dev runs the content and
email tasks.

### Release checklist (database or payment changes)

1. Apply new SQL migrations in Supabase **before** deploying.
2. Add any new environment variables in Vercel, then redeploy.
3. Verify the Paystack webhook URL points at `/api/pay/webhook`.
4. After the first scheduled run, confirm a `200` in Vercel Cron logs.

### Monitoring

- Vercel Analytics for performance
- Sentry for error tracking
- Supabase Logs for database queries
- Custom audit logs for sensitive actions

---

## Payments & Checkout

### Flow

```
Client → /api/pay/start or /api/summit/pay/initiate
           creates payment_attempts (reference, amount_kobo, owner)  ← server-priced
Client → Paystack (hosted page or inline popup)
Paystack → /api/pay/callback | /api/summit/pay/verify | /api/pay/webhook
           └─ all call settleReference(reference)   (lib/paymentSettlement.ts)
```

`settleReference` is the single place a payment becomes access:

1. The reference must exist in `payment_attempts` (we created it). Unknown
   references are ignored, so a payment made outside our flow, or with forged
   metadata, never grants anything.
2. The transaction is verified with Paystack; amount (>= expected), currency and
   owner are compared to the **recorded attempt**, not to client data. Prices
   come from `lib/pricing.ts` (plans) and the `SUMMIT_TICKET_PRICE_*_NGN`
   variables (tickets).
3. The attempt is claimed with a conditional update (`pending → success`), so
   concurrent verify/webhook/cron runs fulfil exactly once and emails are sent
   once. If fulfilment throws, the claim is released for the next retry.
4. Fulfilment: subscriptions update the profile and write a `payments` row;
   Summit tickets mark the registration paid and send the ticket email. A second
   payment for an already-paid registration becomes status `duplicate` and
   alerts admins to refund it.

The webhook returns **5xx** on real processing errors so Paystack retries.

### Abandoned checkouts

Paystack has no "abandoned" webhook, so `lib/paymentReconciliation.ts` polls:

| Paystack says | Result |
|---------------|--------|
| success | Fulfil now (recovers lost webhooks) |
| failed / reversed | Mark `failed` |
| not started / pending, older than 60 min | Mark `abandoned` |

New abandoned attempts trigger **one** admin digest (in-app notification for
each admin plus an email to `ADMIN_EMAIL`) and **one** recovery email to the
customer with a link to finish paying. Attempts older than 7 days are closed
silently, and customers who have since paid are skipped. It runs daily via
Vercel Cron and on demand from **Admin → Payments → Reconcile now**.

### Password reset

Codes come from `crypto.randomInt`, are stored as an HMAC (`lib/otp.ts`),
expire after 15 minutes, allow 5 guesses (counted atomically before comparison)
and are limited to 5 per email per hour. Responses are identical whether or not
the account exists; social-login accounts are told to use their provider.

---

## Dashboard Shell & Search

`components/shell/ShellLayout.tsx` renders both dashboards; `AdminShell` and
`UserShell` only supply navigation, branding and theme.

| Piece | Behaviour |
|-------|-----------|
| Sidebar | Always black. Full logo (`ascentor-color-for-dark-pages.svg`) when open, logo mark only (`ascentor-LM-gold.svg`) when collapsed; every item has an icon and react-tooltip labels appear when collapsed. The avatar at the bottom opens Settings (`/account`) and the logout icon signs out after a confirmation dialog. Collapses on desktop (state saved per dashboard); below 1024 px it is an off-canvas drawer with backdrop, Escape to close and scroll lock |
| Header | Sticky; page title (from the active nav item), search, extra actions (notification bell for members), avatar menu with account links and sign out |
| Global search | `Ctrl/Cmd + K` opens a command palette: matching pages plus debounced server results from `/api/admin/search` or `/api/search` |
| Page-scoped search | A page calls `usePageSearch('Search…')` and filters its own data with the returned query; the header input then filters that page and a **Global** button opens the palette |
| Theming | **Light only; there is no dark mode.** Admin uses THE LEDGER tokens (`[data-ledger]`), members use the `--app-*` tokens (`<html data-app-theme="light">`); both map onto `--sh-*` variables in `styles/shell.css`. The sidebar uses its own black `--sb-*` tokens |

To add an admin page: create `app/admin/<name>/page.tsx` and add an entry to
`NAV_GROUPS` in `components/AdminShell.tsx` (optionally with a `permission`).
To make a page searchable from the header, call `usePageSearch` in it.

### Confirmation dialogs

Every sensitive action asks first, using the in-app dialog in
`components/Modal.tsx` instead of the browser's `confirm()`:

- `confirmAction(message, options?)` works anywhere (event handlers, plain
  functions). It infers the title, button label and red "danger" styling from the
  wording (delete / remove / ban / discard / unpublish ...), or accepts
  `{ title, confirmLabel, cancelLabel, danger }`.
- `useModal()` exposes `alert`, `confirm` and `prompt` inside components.
- Covered actions include sign out (all shells), deletes (courses, events,
  experts, careers, promo codes, messages, channels, marketing content, billboards),
  banning users, removing admins, changing a user's plan, unpublishing,
  publishing a blog post, approving a draft, sending to Buffer, broadcasts,
  newsletters, marking a lesson complete and marking all notifications as read.
  Flows that already had their own inline confirmation (typing DELETE to delete an
  account, the subscription-cancel step, blog and product delete) are unchanged.
- Destructive dialogs focus **Cancel** first, trap Tab focus, close on Escape and
  restore focus afterwards.

### Sage, the floating AI coach

`components/shell/SageFloat.tsx` renders a floating orb in the member app. Once
per login session (`sessionStorage["sage:greeted"]`, cleared on sign-out) it
plays a soft synthesised chime, shows a typing indicator, then types a
personalised greeting based on the time of day with a **Talk to Sage** shortcut
to `/coach`. Clicking the orb reopens the panel at any time. Sound can be muted
(`localStorage["sage:muted"]`); if the browser blocks audio until the user has
interacted, the chime is armed for the first click or key press in the next
10 seconds instead of failing. It respects `prefers-reduced-motion` and is hidden
on `/coach`.

---

## Engineering Log

Running record of significant engineering work, newest first. The system documentation is in
[README.md](README.md); released changes are in [CHANGELOG.md](CHANGELOG.md). This section records the
reasoning, discoveries and decisions behind them.

### 2026-10-06: sign-up with a verification code, clear account errors, account settings

- **Why OAuth then email both failed:** the first attempt hit the broken auth trigger (below). After the fix the
  Google account was created (confirmed, provider google, profile present, onboarding not finished), so an email
  sign-up for the same address correctly cannot create a second password account.
- **Landing on the home page after Google sign-in:** the redirect `/auth/callback` was not in Supabase's allow-list, so Supabase
  fell back to the Site URL with `?code=`. The proxy now forwards that code to the callback, and a signed-in member on
  `/` is routed by registration state. Still add `http://localhost:3000/auth/callback` (and the production callback) to the
  Supabase redirect URLs.
- **OTP design:** the admin API creates the user unconfirmed (Supabase sends nothing); our code is stored hashed in
  `password_reset_otps` with `purpose = 'signup'` (a reset code can never confirm a sign-up); `/api/auth/login` refuses
  unconfirmed users regardless of the Supabase "Confirm email" setting. Tested without sending mail by inserting the
  hashed row and calling the verifier (`npm run test:auth:otp`).
- **SMTP:** port 587 timed out from the development network while 465 connected and authenticated, so the default is
  now 465 with 10 second timeouts.
- **Account lookup messages** deliberately reveal that an address exists (requested for clarity); the endpoints are rate
  limited and CAPTCHA protected.

### 2026-10-06: sign-up outage found and fixed

A test sign-in with Google ended on `/?error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user`.
That message comes from Supabase Auth when its INSERT into `auth.users` fails; the cause was the
`on_auth_user_created` trigger calling `sync_profile_email()`, which updated `profiles` without a schema prefix while Auth
runs with `search_path = auth`. Reproduced in a rolled-back transaction, fixed and verified with
`scripts/dry-run-migration.ts`, then applied. No user had been created in the project since 2026-04-01. Errors that
Supabase reports by redirecting with `error` parameters are now surfaced by `components/AuthRedirectError.tsx`.

### 2026-10-06: local development without the gate

Decision: local means `npm run dev`, not containers. The gate is removed for development only by making
`platformOpen()` true whenever `NODE_ENV === 'development'`; production builds are unchanged (closed unless
`NEXT_PUBLIC_PLATFORM_OPEN=true`). Local runs use the existing Supabase project (a separate project and scripts for one were
written and then removed as unnecessary); a `predev` notice reminds that test data is real data. Release plan: `main` gets no commits until after the Summit; the branch is reviewed through a draft pull
request that is finalised only afterwards. (A Docker-based local Supabase stack was started and abandoned: not what was asked for.)

### 2026-10-05 (later): schema baseline and the RLS audit

Method: `scripts/export-schema.ts` reads the live catalogs (read-only SELECTs through the existing `scripts/db.ts`
connection) and writes `database/migrations/00000000_baseline.sql`: 87 tables, 1008 columns, 280 constraints, 209
indexes, 38 functions, 38 triggers (including the two on `auth.users` that sync profile email), 367 policies. No data
is read. It is idempotent, so it is also safe on the existing project.

What the audit found, by comparing the exported schema with the code:

- **Row Level Security is enabled on every table, but several policies are open to everyone.** Policies named
  "Service role ..." were created `TO public`. The service role bypasses RLS, so they grant it nothing, but they do
  grant their action to `anon` and `authenticated`:
  - `partners`, `partner_members`, `partner_transactions`: `FOR ALL USING (true)`. Anyone holding the anon key can
    read, change and delete every white-label tenant.
  - `payments`, `product_purchases`, `usage_tracking`, `session_locations`, `audit_logs`: `INSERT WITH CHECK (true)`
    (forged payments, purchases, usage and audit entries). `notifications`: any signed-in user may insert for any
    user. `referrals`: open insert and update. `push_subscriptions`, `push_events`: `FOR ALL (true)`.
  - `platform_settings` and `community_categories`: a policy called "admin write" is `FOR ALL (true) TO authenticated`,
    so any signed-in member can change platform settings such as checkout and stream switches.
  - Intentional public-submission forms (contact, newsletter, waitlist, applications, event and survey
    registration) were reviewed and left alone.
  `20261005_lock_down_open_policies.sql` drops these and adds the narrowest replacements the app needs (own-row
  inserts for usage, audit, notifications; participant-only referrals). It was
  idempotent. **Applied to production on 2026-10-05** with `scripts/apply-migration.ts` (one transaction, 5 statements);
  the verification query then returned no open write policies and the six replacement policies exist. Plaintext partner Paystack keys: the legacy `paystack_secret_key` column exists
  and is empty for the one partner on file.
- **Schema drift between code and database**, fixed in `20261005_member_features.sql`: the live `expert_sessions`
  lacked `expert_avatar`, `meeting_url`, `max_attendees`, `current_attendees`, `dimension` and `is_free`, which both
  admin session forms write, so saving a session failed; `partners.paystack_secret_key_enc` (read by partner
  payment verification) did not exist. **Applied to production on 2026-10-05** (no duplicate rows blocked the new unique indexes). The member Sessions page now also maps the older column names so it works
  before and after the migration.
- **Reproducibility**: a new project can now be built from the repository (`database/README.md`).

### 2026-10-05: validation, copy rules, launch switch, contract fixes

Branch `feat/platform-v1` (not for production).

- **Strict validation everywhere.** Added `lib/validation` (helpers, primitives, six schema modules and a
  registry). Roughly eighty route bodies now go through `parseJson` with `z.strictObject`. Unknown fields are
  rejected, bodies over 256 KB are refused, and errors carry a field-level `issues` array.
- **Contract checker.** `scripts/check-api-contracts.ts` statically compares every client `fetch` body with the
  schema for the route. On first run it found three real bugs: the newsletter form sent `name` while the
  server read `firstName` (names were silently dropped); the subscription cancel call sent a `userId` the
  server ignores; and the white-label coach page still spoke the retired streaming protocol
  (`userInput`, `sessionType`) so partner coaching could not work. A fourth was found later: the partner
  members screen sent `member_id` and the action `reactivate`, while the server expects `memberId` and
  `reinstate`.
- **Schema drift found.** The live `expert_sessions` table uses `status` and `scheduled_at`; the TypeScript
  type and the original dashboard query used `is_published` and `session_date`, so the dashboard never showed
  an upcoming session. The type, dashboard, hero card and reminders now agree with the experts page.
- **Proxy fixes.** Protected API prefixes matched without a path boundary, so the public
  `/api/partner-enquiry` form was swallowed by `/api/partner`. `/api/lead-magnet` (public free-download
  capture) was listed as login-only. Both returned 401 to visitors. Matching is now boundary-aware and
  `/api/payment` is listed explicitly.
- **Copy rules.** All em dashes removed from source, comments and documentation; all emoji and decorative glyphs
  removed. Community reactions became an icon vocabulary (`components/community/reactions.tsx`; stored values
  are `userId:reactionId`, unknown legacy values display as a like) and the emoji picker was deleted. Course
  categories and community dimensions use lucide icons. The waitlist selects had raw SVG markup inside label
  strings (rendered as text); they are plain text now. `scripts/lint-copy.js` enforces the rules.
- **Dead code removed.** `app/nav`, `nav`, `app/components`, `app/lib`, `app/middleware`, `app/src` and a stale
  copy of the proxy were unreferenced; `app/nav/*` were still routable legacy dashboards in the old dark theme.
- **Launch switch.** `NEXT_PUBLIC_PLATFORM_OPEN` opens sign-in and sign-up on a branch; production leaves it
  unset and keeps the gate. One helper, `openGateOrSignup()`, drives every join call to action.
- **Migration** `20261005_member_features.sql`: goal milestone columns, upsert targets, lookup indexes, unique
  referral codes.
- **Documentation.** README rewritten as system documentation with architecture, component, use case and
  deployment diagrams and a module and concern table; `docs/api-contracts.md` is generated from the schemas.

### 2026-10-04: authentication hardening

Branch `feat/auth-hardening`, merged to `main` with the public gate unchanged.

- Server-side `/api/auth/login` and `/api/auth/signup`; shared Postgres-backed rate limits with a memory
  fallback; optional Turnstile CAPTCHA; password policy with a breached-password check; location-risk check moved
  server-side and extended to OAuth; staff TOTP flow enforceable with `ADMIN_MFA_REQUIRED`; `/api/welcome`
  bound to the session; push routes made reachable by server callers; reminders cron route added.
- Single post-login router (`lib/auth/post-login.ts`), `/auth/continue`, check-your-inbox screen with resend,
  `safeNext()` open-redirect guard, idempotent onboarding, password reset revokes sessions and notifies.
- Decision: the admin session-revocation call takes an access token, not a user id, so reset signs in with the
  new password briefly and revokes that session globally.
- Decision: a blocked location check ends only the current session; the old code attempted a global sign-out
  with an argument the API does not accept, so it never worked.

### 2026-10-02 to 2026-10-03: member dashboard redesign

- Light theme with the dark sidebar retained. New Today hero, editable 90-day goal (progress derived from
  milestones), commitments with add and remove, six-week consistency strip, summit card, upcoming session and a
  Suspense-streamed Continue rail. Unread Circle counts moved from one query per channel to a single query.
- Broken links to a non-existent `/sessions` route repointed to `/experts`; the dead notification bell removed.
