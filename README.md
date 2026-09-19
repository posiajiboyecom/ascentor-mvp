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
| `ADMIN_EMAIL` | Recommended | Receives admin alerts (abandoned checkouts, payment problems). Defaults to `joinascentor@gmail.com` |
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

- Collapsible sidebar (icon rail with react-tooltip labels on desktop, drawer on
  mobile). The collapsed state is remembered per dashboard.
- Sticky header with page title, search, theme toggle, notifications (member)
  and an avatar menu.
- **Global search**: press `Ctrl/Cmd + K`. Admin search covers users, payments,
  Summit registrations and content, and respects permissions. Member search
  covers courses and sessions.
- **Page-scoped search**: the header input filters the current page when the page
  opts in with one line:

  ```tsx
  const query = usePageSearch('Search courses…');
  // filter your list with `query`
  ```

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
it on demand from **Admin → Payments → Reconcile now**.

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
