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

---

## Platform Architecture

Ascentor is built on a modern, scalable stack optimized for real-time coaching, community features, and content delivery.

### High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js 16    │────▶│   Supabase      │────▶│   PostgreSQL    │
│   (App Router)  │     │   (Auth + DB)   │     │   + RLS         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
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
                                                    ▼
                                          Structured Response
                                                    │
                                                    ▼
                                          Supabase Storage
                                                    │
                                                    ▼
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
- **Summit Payments** (`/admin/summit-payments`): Elevation Summit tickets only.
  Summary cards (confirmed tickets, gross, Paystack fees, net), server-side
  (AJAX) search, filters by status (confirmed, pending, left at payment, not
  started, paying now) and Physical/Virtual, pagination, an off-canvas per record
  (call/WhatsApp, Paystack transaction id, email status, **resend confirmation +
  ticket**, **check Paystack**, delete) and a branded **PDF report** of the
  current search and filters. A paid ticket with no Paystack transaction id is
  flagged.
- **Subscription Payments** (`/admin/payments`): plan checkouts with status
  filters, an off-canvas per attempt, a **Revenue ledger** tab listing every
  paid item behind the revenue figure, deletion of unpaid test attempts, and
  **Reconcile now**. Summit and subscription revenue are always shown as
  separate streams (dashboard cards and colour-coded badges).
- **Summit Livestream** (`/admin/summit-stream`): a live/off toggle and an
  optional specific YouTube video id (blank = auto-embed whatever is live on
  youtube.com/@AscentorGlobal) for the public gate at `/elevation-summit/watch`;
  a table of confirmed virtual attendees with send/resend of the watch-page
  link (individually or all at once), and when each was last sent.
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

`vercel.json` defines one cron: `/api/cron/reconcile-payments`, daily at 07:00
UTC. Vercel Hobby allows at most two crons, each at most once per day, fired
within the scheduled hour, with a 60 s function limit; the job is designed as a
batch sweep for that. It authenticates with `Authorization: Bearer $CRON_SECRET`
and refuses to run if `CRON_SECRET` is not set. Trigger.dev runs the content and
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
