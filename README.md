# Ascentor

Ascentor is a leadership-development platform for African professionals: the
Sage AI coach, The Circle community, expert sessions, a learning library, the
Elevation Summit, and a white-label partner programme.

Stack: **Next.js 16 (App Router) · React 19 · TypeScript · Supabase (Postgres, Auth, RLS) · Paystack · Tailwind 4 · Recharts · Trigger.dev · Capacitor (iOS/Android)**. Deployed on **Vercel**.

Further reading: [wiki.md](wiki.md) (architecture and features) ·
[CHANGELOG.md](CHANGELOG.md) · [SECURITY.md](SECURITY.md) ·
[CONTRIBUTING.md](CONTRIBUTING.md)

---

## Getting started

```bash
npm install
# create .env.local using the variables listed below
npm run dev                  # http://localhost:3000
```

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (also type-checks) |
| `npx tsc --noEmit` | Type-check only (strict mode) |
| `npx eslint .` | Lint the project |
| `npm run trigger:dev` / `trigger:deploy` | Run / deploy Trigger.dev background tasks |
| `npm run build:mobile` | Build and sync the Capacitor apps |

Before pushing, run `npx tsc --noEmit`, `npx eslint .` and `npm run build`.

### Environment variables

Set these in `.env.local` locally and in **Vercel → Project → Settings →
Environment Variables** for production. Never commit real values.

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only, bypasses RLS |
| `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Yes | Payments |
| `SUMMIT_TICKET_PRICE_ONSITE_NGN`, `SUMMIT_TICKET_PRICE_VIRTUAL_NGN` | Yes | Summit ticket prices in naira (numbers only) |
| `CRON_SECRET` | Yes (prod) | Authorises the daily payment-reconciliation cron. Any long random string. Without it the cron refuses to run |
| `ADMIN_EMAIL` | Recommended | Receives general admin alerts (payment problems, abandoned-checkout digest). Defaults to `joinascentor@gmail.com` |
| `SUMMIT_ADMIN_EMAIL` | Optional | Receives the Summit alerts (paid registration, abandoned payment). Defaults to `joinascentor@gmail.com` |
| `DATABASE_URL` | Local only | Postgres connection for Prisma tooling (`npm run db:*`). Supabase **session pooler** or direct string. Never set on Vercel, never committed |
| `SUMMIT_GMAIL_USER`, `SUMMIT_GMAIL_APP_PASSWORD`, `SUMMIT_MAIL_FROM` | Yes | Summit and fallback SMTP mail |
| `NEXT_PUBLIC_URL` | Recommended | Public base URL used in payment redirects and emails |
| `OTP_HMAC_SECRET` | Optional | Key for password-reset code hashing. Falls back to the service-role key |
| `FREE_MODE` | Optional | `true` disables paid gating (emergency override) |

Plan prices live in [`lib/pricing.ts`](lib/pricing.ts) and are the single source
of truth for both checkout and validation.

### Database

SQL migrations are in [`database/migrations/`](database/migrations). They are
applied manually in the Supabase SQL editor (or `supabase db push`) and are safe
to re-run. **Apply them in filename order.** The latest,
`20260919_payment_security.sql`, must be applied before deploying the code that
depends on it (it adds the `payment_attempts` columns and locks down `profiles`).
The Summit operations migrations are `20260920_summit_ops.sql` (Paystack fee and
email-delivery tracking on `summit_registrations`) and
`20260920b_payments_columns.sql` (adds the `payments` columns the app writes).

**Database tooling (Prisma).** Prisma is used for introspection and ad-hoc SQL
only; the SQL migrations remain the source of truth, so never run
`prisma migrate` or `db push`. Put `DATABASE_URL` in `.env.local`, then:

```bash
npm run db:pull       # introspect the live database into prisma/schema.prisma
npm run db:generate   # generate the client into generated/prisma (gitignored)
npx tsx scripts/db.ts "select count(*) from summit_registrations"   # read-only; add --write to change data
npx tsx scripts/backfill-paystack-fees.ts [--write]   # store Paystack's real fee on paid tickets (needs the LIVE key)
```

> The base schema (profiles, payments, coaching tables, ...) predates the
> migrations folder and is not fully captured here. Export the live schema with
> `supabase db dump` and commit it as a baseline.

---

## Project structure

```
app/
  (app)/          Member app (dashboard, coach, community, learn, experts, account)
  (marketing)/    Public marketing pages (Summit, events, movement)
  admin/          Admin console (role-gated)
  admin-login/    Staff sign-in
  api/            Route handlers (payments, admin, auth, search, cron, ...)
  p/[subdomain]/  White-label partner sites
components/
  shell/          Shared dashboard shell: sidebar, header, search (admin + member)
  admin/          Admin widgets (OverviewCharts, PaymentHealth, ...)
lib/              Server helpers: paymentSettlement, paymentReconciliation, otp, pricing, ...
database/         SQL migrations
styles/           shell.css (shell), admin-ledger.css (admin design system)
proxy.ts          Edge proxy: auth, CSP nonce, route gating
vercel.json       Cron schedule
```

---

## Key systems

### Dashboards and search

Both the admin console and the member app use one shell,
[`components/shell/ShellLayout.tsx`](components/shell/ShellLayout.tsx):

- **Light theme only.** There is no dark mode anywhere in the app; only the
  sidebar is black.
- Black collapsible sidebar: the full logo when open, just the logo mark when
  collapsed, an icon on every item (react-tooltip labels on desktop when
  collapsed) and a drawer on mobile. The collapsed state is remembered per
  dashboard. The signed-in avatar at the bottom opens Settings and the logout
  icon signs out after a confirmation dialog.
- Sticky header with page title, search, notifications (member) and an avatar
  menu.
- **Global search**: press `Ctrl/Cmd + K`. Admin search covers users, payments,
  Summit registrations and content, and respects permissions. Member search
  covers courses and sessions.
- **Page-scoped search**: the header input filters the current page when the page
  opts in with one line:

  ```tsx
  const query = usePageSearch('Search courses…');
  // filter your list with `query`
  ```

### Confirmation dialogs

Sensitive actions (delete, remove, ban, sign out, mark complete, mark all as
read, publish, broadcast, ...) must ask first. Do not use the browser's
`confirm()`; use the in-app dialog:

```tsx
import { confirmAction } from '@/components/Modal';

if (!(await confirmAction('Delete "Course A"? This cannot be undone.'))) return;
```

The title, button label and red "danger" styling are inferred from the wording
(or pass `{ title, confirmLabel, danger }`). Inside components you can also use
`const { confirm, alert, prompt } = useModal()`. Enclosing functions must be
`async`.

### Sage (floating AI coach)

`components/shell/SageFloat.tsx` shows a floating orb in the member app. Once per
login session it plays a soft chime and types out a personalised, time-of-day
greeting with a shortcut to `/coach`. The sound can be muted from the panel
(remembered), it respects `prefers-reduced-motion`, and if the browser blocks
audio until the first click the chime is deferred rather than lost. It is hidden
on `/coach`. Signing out clears the flag so the next login is greeted again.

### Payments

Every checkout (subscription or Summit ticket) creates a row in
`payment_attempts` with the amount, currency and owner recorded **server-side**.
The browser verify call, the Paystack callback, the webhook and the cron job all
funnel through [`lib/paymentSettlement.ts`](lib/paymentSettlement.ts):

- A reference only counts if we created it; amount, currency and owner are
  checked against the recorded attempt, never against client-supplied metadata.
- Fulfilment is claimed atomically (`pending → success`), so it happens exactly
  once and emails are not duplicated.
- The webhook returns 5xx on real failures so Paystack retries.

**Abandoned checkouts.** Paystack sends no "abandoned" event, so a daily cron
(`/api/cron/reconcile-payments`, see `vercel.json`) re-checks pending attempts,
recovers payments whose webhook was lost, marks stale ones abandoned, emails
admins one digest, and sends the customer a recovery link. Admins can also run
it on demand from **Admin → Summit Payments → Check Paystack now**. The same
sweep adopts older Paystack payments that have no attempt row, retries failed
confirmation emails and stores Paystack's real fee on paid tickets.

**Summit payments are separate from subscriptions.** Elevation Summit tickets
are managed only at **Admin → Summit Payments** (`/admin/summit-payments`);
plan subscriptions live at **Subscription Payments** (`/admin/payments`). The
Summit page has server-side search, status and Physical/Virtual filters, an
off-canvas per record (call/WhatsApp, Paystack transaction, resend ticket,
delete) and a branded **PDF report** of the current view.

**Summit livestream.** `/elevation-summit/watch` is a public, email-gated page:
a visitor enters the email they registered with, and if it belongs to a PAID
registration they get the embedded YouTube stream (any other result — not
found, not yet paid — shows a clear explanation, never the video). A
convenience cookie skips re-typing the email on a refresh; the server always
re-checks that exact email against the database, so the cookie is not a
security boundary. Admins control it from **Admin → Summit Livestream**
(`/admin/summit-stream`): a live/off toggle, an optional specific YouTube video
id (leave blank to auto-embed whatever is currently live on
youtube.com/@AscentorGlobal), and a button to email the watch-page link to
every confirmed **virtual** attendee (physical attendees are never included).
Settings live in `platform_settings` (`summit_stream_enabled`,
`summit_stream_video_id`) — see migration `20260923b_summit_stream.sql`.
Turning the toggle on before the channel is actually live shows YouTube's own
"video unavailable" message, so flip it on right as the stream starts, not
hours ahead.

**Summit emails.** Registrants get a "Complete your registration" email on
submit and a confirmation with the PDF ticket after payment. The admin
(`SUMMIT_ADMIN_EMAIL`) gets an email when a payment is paid (name, email, phone,
virtual/physical) and when someone leaves before paying (sent immediately from
the browser via `/api/summit/pay/abandon`, with the daily sweep as backup).
Delivery is tracked; failures are retried or can be resent from the admin.

> **Vercel Hobby limits:** cron jobs may run at most once a day (at roughly the
> scheduled hour) and functions are capped at 60 s. The job is a batch sweep,
> so this is fine; on a paid plan the schedule can be made more frequent.

### Admin access

Admins use the **same accounts** as members; admin is a `role` on the profile
(`admin` or `moderator`). Because the public `/login` and `/signup` routes are
currently closed behind the community gate, staff sign in at **`/admin-login`**
(unlisted, not indexed). After sign-in the role is verified and non-staff
sessions are ended immediately. "Forgot password" uses the normal reset flow and
returns to the admin sign-in.

### Security notes

See [SECURITY.md](SECURITY.md). Highlights: a database trigger stops clients
editing billing/role columns on `profiles`; password-reset codes are hashed,
attempt-limited and never reveal whether an account exists; CSP is nonce-based.

---

## Deployment

Pushing to `main` deploys via Vercel. Checklist for a release that changes the
database or payments:

1. Apply any new migration in Supabase first.
2. Make sure new environment variables exist in Vercel, then redeploy.
3. Confirm Paystack's webhook URL is `https://<your-domain>/api/pay/webhook`.
4. After the first day, check Vercel → Cron Jobs for a `200` from
   `/api/cron/reconcile-payments`.
