# Mail addresses, and the "contact@ User doesn't exist" bounce

## What the bounce says
Hostinger's mail system (`de-fra-smtpout6.hostinger.io`) returned:

```
<contact@joinascentor.com>: host mx1.hostinger.com said: 550 5.1.1 Recipient address rejected: undeliverable address:
host fr-int-smtpin21.hostinger.io [private/dovecot-lmtp] said: 550 5.1.1 <contact@joinascentor.com> User doesn't exist
(in reply to RCPT TO command)
```

Read plainly:
- The mail reached Hostinger (`mx1.hostinger.com`), so the domain's MX records are right.
- Hostinger's own mail store (dovecot) then said **no mailbox or forwarder named `contact` exists** on joinascentor.com.
- It is a problem with the recipient, not with our login. The message was accepted for sending, and only the last hop failed.

### Spelling check
The domain in the bounce was read from the screenshot with OCR and compared letter by letter with the repo: `joinascentor.com` (16 characters) in both. It is not a typo, not the old `ascentorbi.com`, and has no stray space. The same `contact@joinascentor.com` appeared 34 times across the code, so the address was spelled consistently; it simply does not exist at Hostinger as a working address.

### Every address the code used (before this change)
| Address | Where | Role |
|---|---|---|
| `hello@joinascentor.com` | `lib/contact.ts` default From; hard-coded From in waitlist, event register/notify, Summit notify, notify.ts, contact form, partner mails | **From** |
| `contact@joinascentor.com` | `lib/contact.ts` `CONTACT_EMAIL`; default Reply-To in `lib/nodemailer.ts` | **Reply-To** (never bounces on send) |
| `contact@joinascentor.com` | `SUMMIT_ADMIN_EMAIL` (`lib/summitEmails.ts`): alert "New registration: ..." and "New donation..." | **To** (admin alert) |
| `contact@joinascentor.com` | `lib/adminAlerts.ts` (`alertNewMember`, `alertEventRegistration`) | **To** (admin alert) |
| `contact@joinascentor.com` | `app/api/contact/route.ts`, `partner-enquiry`, `partner/apply` (founder/admin copy) | **To** |
| `contact@joinascentor.com` | `lib/paymentSettlement.ts` `notifyAdmins` (payments, shop) | **To** |
| `contact@joinascentor.com` | footer, support/help, billing, settings, privacy, careers, checkout, contact page, Summit CTA links, demo pages, JSON-LD | shown to visitors / `mailto:` |
| `contact@joinascentor.com` | Terms page | shown to visitors (**not edited**, see below) |

### Which code path sent to contact@
The bounce is a delivery report for a mail whose **recipient** was contact@, so it came from one of the "To" rows above. Reply-To cannot produce this error. The most frequent one is the admin alert on every confirmed Summit registration (`sendAdminPaymentNotification`, subject `New registration: <name> (Physical|Virtual)`), followed by `alertEventRegistration` (subject `Event registration: <name> for <event>`), `alertNewMember` (subject `New member: ...`), the contact form copy, and payment alerts. The screenshot does not show the subject, so the exact path cannot be named from it. **To pin it down:** open the bounce email, open the attached original message (the 11 KB attachment), and read its `Subject:` line; match it against the list above.

### What the bounce says about the SMTP login
Hostinger accepted the message from our mailbox and rejected only the recipient. That means the login was accepted at that moment, so the earlier `535 authentication failed` problem was **not occurring for this message**. It does not prove the login is fixed everywhere: the bounce does not say which deployment sent it or when. Check `SEND FAILED` in Vercel logs (kind `auth`) to be sure.

## Why an alias can bounce
On Hostinger, `contact@` works only if it exists in hPanel as an **Email Forwarder** (or a real mailbox). Typical reasons for "User doesn't exist":
- it was never created, or was created on a different domain;
- it was deleted when the plan or domain changed;
- it is a forwarder whose destination mailbox was removed or renamed, or it is disabled;
- the domain's email service is attached to a different Hostinger plan than the one where the forwarder was made.

## Steps for Posi (hPanel)
1. hPanel > **Emails** > the domain `joinascentor.com` > **Email Accounts**: confirm `a.samuel@joinascentor.com` exists and you can open its webmail.
2. Same area > **Forwarders** (Email Forwarders): look for `contact@joinascentor.com`. It must be listed, **Active**, and its destination must be `a.samuel@joinascentor.com`.
3. If it is missing, disabled, or points anywhere else: delete it, then **Create forwarder**: from `contact@joinascentor.com`, to `a.samuel@joinascentor.com`.
4. hPanel > **Domains** > `joinascentor.com` > **DNS / Nameservers**: the MX records must be `mx1.hostinger.com` (priority 5) and `mx2.hostinger.com` (priority 10) and nothing else. The bounce shows `mx1.hostinger.com` answering, so this part is already right.
5. From a personal Gmail account, send a message to `contact@joinascentor.com`. Check that it arrives in the `a.samuel@` inbox (also look in spam). Tell Kenny the result.
6. Only after step 5 works: in Vercel set `MAIL_ALLOW_ALIASES=true`, and (optional) set `SUPPORT_EMAIL` and `NEXT_PUBLIC_SUPPORT_EMAIL` to `contact@joinascentor.com`, `MAIL_REPLY_TO` to the same, then redeploy.

## What the code does now
All addresses live in `lib/contact.ts`. Sending defaults to the real mailbox `a.samuel@joinascentor.com`; the address shown to visitors defaults to `joinascentor@gmail.com`. Nothing defaults to `contact@` or `hello@`.

| Env variable | Controls | Default |
|---|---|---|
| `MAIL_FROM` | the From line of every mail (`EMAIL_FROM` still read) | `Ascentor <a.samuel@joinascentor.com>` |
| `MAIL_REPLY_TO` | where replies go | `a.samuel@joinascentor.com` |
| `ADMIN_NOTIFY_EMAIL` | team alerts (sign-ups, contact form, Summit, payments) | `a.samuel@joinascentor.com` |
| `SUPPORT_EMAIL` and `NEXT_PUBLIC_SUPPORT_EMAIL` | the address shown to visitors (set both to the same value) | `joinascentor@gmail.com` (a.samuel@ is reserved for serious business mail; the CEO moves those across from the Gmail inbox) |
| `MAIL_ALLOW_ALIASES` | set `true` to stop redirecting mail addressed to `contact@` | unset |

Other facts:
- **From vs Reply-To:** the SMTP login can only send as its own mailbox. An alias goes in `MAIL_REPLY_TO`, not `MAIL_FROM`. The mailer already retries once as the mailbox if the server refuses a From address.
- **Safety net:** until `MAIL_ALLOW_ALIASES=true`, any message addressed to `contact@joinascentor.com` is redirected to `ADMIN_NOTIFY_EMAIL` and logged as `[email] recipient is an unproven alias`. So an old Vercel value (`FOUNDER_EMAIL`, `ADMIN_EMAIL`, `SUMMIT_ADMIN_EMAIL`, `ADMIN_ALERT_EMAIL`) that still says `contact@` cannot bounce.
- **A bounce never breaks a signup or registration.** Every admin alert is sent inside a try/catch after the member's own work is saved (`adminAlerts.ts`, `summitEmails.ts`, `paymentSettlement.ts`, `events/register`). A delivery report arrives later as a separate email and cannot reach the request.
- **Terms page:** it still shows `contact@joinascentor.com` in three places. It was not edited because the Terms page is off-limits. Either fix the alias (steps above) or ask for the Terms text to be changed.
- Vercel: also check that none of `EMAIL_FROM`, `SUMMIT_MAIL_FROM`, `FOUNDER_EMAIL`, `ADMIN_EMAIL`, `SUMMIT_ADMIN_EMAIL`, `ADMIN_ALERT_EMAIL` is set to `contact@` or `hello@`; set `MAIL_FROM` and `ADMIN_NOTIFY_EMAIL` explicitly.

## Summit registrant emails come from summit@joinascentor.com
- Every email a **registrant** receives from the Summit (confirmation and ticket, resend, the bulk resend, payment reminder, stream access, event-day emails, donation receipt, and the Summit notification broadcast) is sent **From** `The Elevation Summit <summit@joinascentor.com>` with **Reply-To** `summit@joinascentor.com`. Set `SUMMIT_MAIL_FROM` (a bare address or `Name <address>`) to change it. Keep the domain `joinascentor.com` so SPF, DKIM and DMARC line up.
- **Team alerts** about the Summit (new registration, new donation) are *not* registrant mail. They still come from `MAIL_FROM` and go to `ADMIN_NOTIFY_EMAIL`.
- **If `SUMMIT_MAIL_FROM` is already set in Vercel** (it was an older setting), it wins over the default. Set it to `summit@joinascentor.com` or delete it.
- **Safe fallback:** if the mail server refuses that From address as not allowed for the mailbox (a real sender refusal such as 553 / 550 5.7.x, never a 535 login failure), the mailer retries **once** with From set to the SMTP mailbox (`a.samuel@joinascentor.com`) and Reply-To set to `summit@joinascentor.com`. The message goes out and replies still reach summit@. A 535 login failure is never retried this way, it is reported as a login problem. The delivery row has no column that records which sender was used (and no migration was added), so the Vercel function log line `[email] sender refused, retrying as the mailbox` is the only trace.
- **Confirm sending as summit@ is allowed (Hostinger):** hPanel > Emails > make sure `summit@joinascentor.com` exists (a mailbox, or a forwarder to `a.samuel@`) and, if hPanel offers a "send as" / alias option for the mailbox, switch it on; then send a Summit test email to a Gmail address, open it, press the three dots > **Show original**, and check that SPF and DKIM both say **PASS** and the From is summit@joinascentor.com.
- **contact@ is still excluded in the code.** `guardRecipient` in `lib/nodemailer.ts` redirects anything addressed to `contact@joinascentor.com` to the team inbox until `MAIL_ALLOW_ALIASES=true` is set in Vercel. Once Posi has proved from Gmail that contact@ arrives, set that variable (or empty `UNPROVEN_ALIASES` in `lib/contact.ts`) and redeploy. Admin notifications stay on `ADMIN_NOTIFY_EMAIL` either way.
