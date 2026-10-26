# Summit email hotfix: what happened and what to do

## Root cause
Hostinger rejects the mailbox login with `535 5.7.8 authentication failed` (code `EAUTH`, command `AUTH PLAIN`). The mailbox is `SMTP_USER` (the log shows `a.samuel@joinascentor.com`). The credentials in Vercel (`SMTP_USER` / `SMTP_PASS`) are wrong, stale, or the mailbox is locked.

The log line "sender refused, retrying as the mailbox" was misleading. The old `refusedSender()` matched the word "authenticat", so the 535 login failure was treated as a refused From address, and the code logged in a second time as the mailbox, which failed the same way. `summit@` was never refused; the login itself failed before any sender check. Fixed in code: a login failure is now reported as a login failure, never retried, and pauses further logins for 2 minutes.

## Do now, in this order
1. **Hostinger.** hPanel > Emails > Email Accounts. Open the mailbox named in Vercel's `SMTP_USER`. Log in to its webmail with the password Vercel holds.
   - If webmail refuses that password: the password in Vercel is wrong or stale. Set a new password (Change password), then continue.
   - If webmail accepts it but Vercel still fails: check `SMTP_USER` is the full address with no spaces and that the mailbox is not suspended or over its sending limit (hPanel shows this on the account).
   - Prefer the shared role mailbox `hello@joinascentor.com` (as in `docs/email-runbook.md`) over a person's mailbox.
2. **Vercel** (Ascentor project, Settings > Environment Variables, Production): set `SMTP_USER` (full mailbox address) and `SMTP_PASS` (its password). Check `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`.
   - `SUMMIT_MAIL_FROM`: delete it, or set it to the mailbox address itself. The reply-to is already the Summit contact address. (If you want mail to say `summit@`, first make `summit@` a real alias of the mailbox in Hostinger; I could not verify the alias steps from here.)
3. **Deploy the hotfix branch** (below), then **Redeploy** so the new variables load.
4. In **Admin > Elevation Summit > Registrations**, press **Resend all unsent tickets**. Each press sends 4 people, spaced out. Press again until it says everyone has been sent. Safe to press repeatedly; nobody is emailed twice.

## Test the login in 2 minutes
- Webmail: sign in to Hostinger webmail with the exact mailbox and password Vercel holds.
- From a terminal, with the same values in `.env.local` (prints nothing secret): `npx tsx scripts/test-email.ts --verify` prints `OK` or `FAILED: auth`.

## Registrants who have no email
They can open their ticket at `https://joinascentor.com/elevation-summit/ticket` with their email and the WhatsApp number they registered with (or the `ES-` code on their confirmation screen). Share this link on WhatsApp / social.

## Optional fallback provider (Resend), OFF until you switch it on
1. Create a Resend account, add the domain `joinascentor.com`, and copy the DNS records Resend shows (the DKIM value is unique to you). They are typically:
   - TXT `resend._domainkey` = `p=...` (from Resend)
   - MX `send` -> `feedback-smtp.<region>.amazonses.com`, priority 10 (region shown by Resend)
   - TXT `send` = `v=spf1 include:amazonses.com ~all`
   - TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:<your address>` (only if you have no DMARC record yet)
   These sit on the `send` subdomain and `resend._domainkey`, so the existing Hostinger SPF/DKIM on the root domain is not changed.
2. When Resend shows the domain as Verified, add in Vercel: `EMAIL_FALLBACK_PROVIDER=resend`, `RESEND_API_KEY=<key>`, optionally `EMAIL_FALLBACK_FROM=Ascentor <hello@joinascentor.com>`. Redeploy.
3. The fallback is used only when SMTP is missing, in its login cooldown, or fails.
