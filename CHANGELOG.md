# Changelog

All notable changes to the Ascentor platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Summit livestream)
- **Public watch page** (`/elevation-summit/watch`): enter the email you
  registered with; a PAID registration gets the embedded YouTube stream, any
  other result gives a clear explanation (not found / not yet paid) instead of
  the video. A convenience cookie skips retyping the email on a refresh; the
  server always re-validates that exact email, so the cookie grants nothing by
  itself.
- **Admin → Summit Livestream** (`/admin/summit-stream`): live/off toggle,
  optional specific YouTube video id (blank auto-embeds whatever is currently
  live on youtube.com/@AscentorGlobal, resolved channel id `UCK2ixTgohGdFcfGTDoxYCWQ`),
  and sending the watch-page link by email to confirmed **virtual** attendees
  only (individually or all at once), with per-person send history.
- Settings stored in `platform_settings`; migration `20260923b_summit_stream.sql`
  adds `summit_registrations.stream_access_sent_at` and seeds the settings rows.

### Fixed (Summit payments, ticketing and registration)
- **Legacy payments were unrecoverable:** Summit payments made before
  `payment_attempts` existed were rejected as "unknown reference" forever. The
  reconciliation sweep now scans recent Paystack transactions and adopts them.
- **Silent email failures:** the confirmation email and admin alert were sent in
  one `try/catch`, so one failure lost both with no record. They are now
  independent, tracked (`confirmation_email_sent_at`, `confirmation_email_error`),
  retried by the sweep and resendable from the admin. Summit mail now fails
  loudly instead of skipping when SMTP is missing.
- **Phone numbers lost:** returning registrants and in-app placeholder rows never
  had their phone, company or role updated. They are now saved on every submit.
- **Paid tickets could be self-deleted** through the in-app unregister route;
  now blocked. Email blasts treat "confirmed" as paid only.
- **Revenue accuracy:** the dashboard's 31K figure included 20K of developer test
  payments (removed). The `payments` table lacked the `amount` column the app
  writes, so subscription revenue silently read 0; added by migration, and the
  queries now tolerate the real schema.
- Payment health no longer reports checkouts pending for over an hour as "in
  progress".

### Added (Summit payments, ticketing and registration)
- **Admin → Summit Payments** (`/admin/summit-payments`): Summit-only payments
  management with server-side search, status and Physical/Virtual filters,
  pagination, an off-canvas per record, resend ticket, check Paystack, delete,
  and a branded PDF report.
- **Emails:** registrants get "Complete your registration" on submit and a
  confirmation with the PDF ticket on payment. The admin gets a paid-registration
  email (name, email, phone, virtual/physical) and an immediate email when
  someone leaves before paying (`/api/summit/pay/abandon`).
- **Paystack fees:** real fees are stored per ticket (`paystack_fee`) and shown
  as gross, fees and net; older tickets are filled in by **Check Paystack now**.
- **Subscription Payments** page: off-canvas details, Revenue ledger and
  test-data deletion; Summit and subscription revenue are separated everywhere.
- **Prisma tooling** (introspection and ad-hoc SQL only): `npm run db:pull`,
  `db:generate`, `scripts/db.ts`, `scripts/backfill-paystack-fees.ts`.
- **Payment reminders:** admins can email a payment reminder to one unpaid
  registrant, open a prefilled WhatsApp reminder, or **Remind all pending**
  (skips anyone reminded in the last 24 hours; capped at 40 per run). Reminder
  history is tracked (`reminder_sent_at`, `reminder_count`, migration
  `20260920c_summit_reminders.sql`).
- **Critical bug: Paystack reference matching never worked.** The regex used to
  recognise our own `summit-<id>-<timestamp>` references lost its backslash in
  an earlier edit (`-d+$` instead of `-\d+$`), so it could never match a real
  reference. Every payment that needed the reference-based adoption path (a
  lost webhook, a browser that closed before confirming) silently failed to be
  picked up by "Check Paystack" and the daily sweep. Fixed.
- **Paystack matching by email:** "Check Paystack" and the daily sweep now also
  match a successful Paystack payment to an unpaid registration by the payer's
  email and amount, so a payment made under a reference we never recorded is
  confirmed instead of staying "pending". An admin can also paste a Paystack
  reference; it is verified with Paystack before anything changes.
- **Unmatched-payment picker:** when neither reference nor email matching finds
  the payment, "Check Paystack" now lists recent successful Paystack
  transactions of at least the ticket price that aren't linked to anyone, so
  the admin can confirm the right one in one click without leaving the page.
- Summit Payments opens on **Confirmed** payments by default and uses the full
  width of the page (`data-fullwidth` opt-out of the shell's 1360px column).
- New Elevation Summit hero flyer.
- Migrations `20260920_summit_ops.sql`, `20260920b_payments_columns.sql` and the
  review-first `database/scripts/clean_test_data.sql`.

### Security
- **Profiles:** a database trigger now blocks clients from editing billing and
  privilege columns (`subscription_*`, `billing_cycle`, `payment_method`,
  `card_details`, `paystack_*`, `referral_count`, `role`, `permissions`).
  Previously any signed-in user could grant themselves a paid plan from the
  browser console.
- **Summit registrations:** removed the client-side insert and delete RLS
  policies; registrations are created only through the API.
- **Payments:** every checkout now creates a `payment_attempts` row. A payment
  is only honoured if its reference belongs to an attempt we created, and its
  amount, currency and owner match what the server recorded. This closes ticket
  replay (one payment unlocking many registrations) and forged-metadata plan
  upgrades made with the public Paystack key.
- **Webhook:** the shared Paystack webhook settles through one code path, ignores
  references we did not create, and returns 5xx on real failures so Paystack
  retries. The legacy Summit webhook handler (which used a single, possibly unset
  price) was removed.
- **Password reset:** codes use `crypto.randomInt` and are stored hashed; five
  guesses per code (atomic, so parallel requests cannot multiply them); five
  codes per email per hour; per-IP limits; identical responses whether or not an
  account exists; lookups no longer scan `auth.admin.listUsers()` (which only
  returned the first page).
- Removed committed build artifacts (`.trigger/`, `supabase/.temp`,
  `tsbuildinfo`), a saved web page under `public/icon`, empty `git`/`main`
  files and a stale `next.config` copy; added them to `.gitignore`.

### Added
- **Sage, the floating AI coach:** an animated orb in the member app that, once
  per login session, plays a soft chime and types a personalised, time-of-day
  greeting with a shortcut to `/coach`. Mutable, respects reduced motion, defers
  the sound if the browser blocks audio, hidden on `/coach`.
- **Confirmation dialogs everywhere:** `confirmAction()` in `components/Modal.tsx`
  (wording-aware title, label and red danger styling). All 27 native `confirm()`
  calls were converted, and sign out (every shell), mark lesson complete, delete
  post, mark all notifications read, publish blog post, approve draft, send to
  Buffer, remove from queue and broadcast now ask first.
- **Sidebar redesign:** always black; full logo when open and the logo mark only
  when collapsed; an icon on every item; the signed-in avatar opens Settings and
  a logout icon signs out after confirmation.
- **Abandoned-checkout handling:** a daily Vercel cron
  (`/api/cron/reconcile-payments`, Hobby-plan compatible) re-verifies pending
  attempts with Paystack, recovers payments whose webhook was lost, marks stale
  attempts abandoned, sends admins one digest (in-app notification and email)
  and emails customers a recovery link. Requires `CRON_SECRET`.
- **Admin dashboard redesign:** new shared shell with a collapsible sidebar and
  react-tooltip labels, a mobile drawer, and a sticky header with avatar menu,
  theme toggle and search. The overview now shows KPIs and Recharts graphs
  (revenue, subscriber mix, signups vs sessions, checkout funnel) backed by one
  server-side endpoint (`/api/admin/analytics`).
- **Admin → Payments** page: ledger of every checkout attempt with status
  filters, page-scoped search and a **Reconcile now** action; abandoned and
  failed counts on the overview.
- **Global search** (`Ctrl/Cmd + K`) for admin (`/api/admin/search`, permission
  aware) and members (`/api/search`), plus **page-scoped search** in the header
  (`usePageSearch`), wired into Learn, Experts and Payments.
- **Member app redesign:** the fixed rail and bottom tab bar are replaced by the
  same collapsible sidebar and mobile drawer, with sticky header, notifications
  and avatar menu. Rail billboards and the Summit countdown card are kept.
- **`/admin-login`:** dedicated, unindexed staff sign-in (same accounts; role
  verified after sign-in), needed because `/login` and `/signup` are closed
  behind the community gate. Password reset returns to it when started from it.
- Migration `20260919_payment_security.sql` (idempotent); it also creates
  `password_reset_otps` if missing.
- Dependencies: `recharts`, `react-tooltip`.
- README rewritten (setup, environment variables, structure, payments, admin
  access, deployment checklist).

### Changed
- **Elevation Summit speakers:** "Lekan Omotosho" is now "Olamilekan Omotosho",
  and Divine Mmachukwu Chukwuemeka moved from 6th to 4th.
- **Light theme only.** Dark mode was removed everywhere: the theme toggles (shell
  header, account "Display" section, checkout, legacy shells), the dark CSS token
  blocks, the theme-initialiser scripts and both theme providers. The app renders
  with `<html data-app-theme="light">` and admin pages inside a plain
  `<div data-ledger>`.
- The confirmation modal was rebuilt: light styling, red destructive button,
  Cancel focused first for destructive actions, focus trap, Escape to close and
  proper dialog roles.
- Plan prices are read from `lib/pricing.ts` everywhere (removed the duplicate
  table in `pay/start`).
- Summit ticket prices are validated per attendance type; a missing or invalid
  price now fails initiation instead of silently disabling the check.
- Re-registering a pending Summit email now updates the ticket type so the price
  charged matches the selection.
- A second successful payment for an already-paid registration is flagged to
  admins as a duplicate needing a refund.
- Unauthenticated `/admin` visits and expired admin sessions redirect to
  `/admin-login` instead of the closed gate.
- Payment initiate/verify and `pay/start` are rate limited.
- **Lint and build are clean:** `npx eslint .` reports 0 errors (980 style
  warnings remain, mostly `any` and hook-dependency notes that the config
  deliberately downgrades) and `npm run build` succeeds. Fixed 26 pre-existing
  errors: `prefer-const` (10 files), refs read during render (`useMemo` instead
  of `useRef(...).current` in `hooks/useChannelMessages.ts` and
  `admin/community-intel`), a `require()` in the personal-brand image route, and
  a component created during render in the legacy `nav/coach` page.
- `eslint.config.mjs` now ignores generated and tooling output (`.trigger`,
  `.kilo` worktrees, `android`, `ios`, `public`, `supabase/.temp`) which
  previously produced hundreds of false errors.

### Removed
- The "Stay in the loop" push-notification banner (`PushPermission`) is disabled
  completely: it is no longer mounted in `app/layout.tsx`, so visitors are never
  prompted. The component is kept, marked DISABLED, in case it is re-enabled.
- `components/AppThemeProvider.tsx`, `components/AdminThemeProvider.tsx`, the
  "Display" (dark mode) section of the account page and every dark-mode toggle.
- Legacy `lib/summitWebhookHandler.ts` and metadata-based plan grants in the
  subscription webhook handler.
- Unused duplicate `app/components/AdminShell.tsx` and
  `components/ui/AdminShell.tsx`.

### Known issues
- `/login` and `/signup` remain closed behind the community gate.
- `app/api/subscription/webhook` is a second, legacy webhook that is blocked at
  the edge today; it should be deleted.
- Duplicate code trees (`components/proxy.ts`, `app/lib`, `app/components`,
  `nav/`, `free/`) and the now-unused `components/nav/DesktopRail` and
  `MobileTabBar` still need cleanup.
- Referral lookup runs under the member's own session and is blocked by RLS.
- The base database schema is not yet captured in `database/`.

### Added (earlier, unreleased)
- Hero section image carousel with auto-rotation and dot navigation
- Terms & Conditions page (`/terms`)
- Privacy Policy page (`/privacy`)
- Mobile header CTA button
- Social media icon links in footer with hover effects
- Documentation: README.md, wiki.md, security.md, contributing.md

### Changed (earlier, unreleased)
- Mobile off-canvas menu z-index increased to appear above navigation bar
- Footer layout restructured: social links moved under logo as icon buttons
- Footer bottom now shows copyright + legal links instead of quote + social texts

### Fixed (earlier, unreleased)
- Off-canvas menu appearing behind navigation bar on mobile

---

## [0.1.0] - 2026-09-09

### Added
- Initial project setup with Next.js 16 and TypeScript
- Supabase integration with PostgreSQL and RLS
- Authentication system (email/password + Google/LinkedIn OAuth)
- Landing page with CMS-backed hero section
- Marketing pages: Movement, Elevation Summit, Who It's For, About, Contact
- Blog system with admin CMS
- User dashboard with stats and quick actions
- Sage AI coaching integration (Anthropic Claude)
- The Circle community features
- Expert session management
- Partner portal with white-label capabilities
- Admin dashboard with role-based access
- Newsletter subscription system
- Event management system
- Payment integration (Paystack, Selar)
- Push notifications
- PWA support with Capacitor
- Mobile-responsive navigation and bottom tab bar
- Dark/light theme support
- SEO optimization with sitemap and robots.txt
- Security: RLS policies, audit logging, rate limiting

### Security
- Row-Level Security on all database tables
- Encrypted session management
- Server-side API validation
- Rate limiting on sensitive endpoints
- Audit logging for sensitive actions

---

## Versioning

- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality in a backward-compatible manner
- **PATCH**: Backward-compatible bug fixes

## Release Process

1. Update this CHANGELOG.md with new version and changes
2. Update version numbers in package.json
3. Create a git tag: `git tag v0.x.x`
4. Push tag: `git push origin v0.x.x`
5. Deploy to production via Vercel
