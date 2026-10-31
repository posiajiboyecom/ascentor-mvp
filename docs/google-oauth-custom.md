# Google sign-in on joinascentor.com (instead of the Supabase address)

**Why:** Google's "Choose an account" screen shows the address of the Supabase project because Supabase runs the redirect. A custom Supabase domain needs their paid plan. This change runs the Google step ourselves (`/api/auth/google`) and hands Google's result to Supabase, so people see joinascentor.com.

**Nothing changes until you flip the switch.** `GOOGLE_AUTH_MODE` defaults to `supabase` (the old flow). If you set `custom` but a credential is missing, the app quietly keeps using the old flow and logs a warning (it never prints a secret).

## What was built
- `GET /api/auth/google` starts the flow: random state, PKCE verifier and nonce kept in a 10 minute, HttpOnly, SameSite=Lax cookie (Secure in production), then a redirect to Google (scopes `openid email profile`, S256 code challenge, SHA-256 of the nonce).
- `GET /api/auth/google/callback` checks the state against the cookie (missing, wrong or expired is refused), swaps the code for an `id_token` at Google (with the verifier and client secret), calls `supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })` with the server client, so the session cookies are set the same way as before, then clears the cookie.
- After the session exists, the **same steps as the old flow** run (shared code, `lib/auth/complete-signin.ts`): the unusual-location check, partner whitelist, MailerLite sync, and the one router that sends new people to onboarding and returning people to their dashboard or `next`.
- Return paths are same-site only (no open redirects). Both routes are rate-limited (20 per 5 minutes per address). A cancelled sign-in, wrong state, Google error or Supabase error all end on `/login` with a plain message. The code, tokens and secret are never logged by the app.
- The Google buttons on `/login`, `/signup` and the partner login/signup pages go to `/api/auth/google` only when the switch is on. LinkedIn is untouched.
- **Referral codes** work as before: `?ref=` is remembered in the browser and redeemed after sign-in, which does not depend on the sign-in method.

### An existing email/password account that signs in with Google
Supabase links identities that share a verified email address, so the person gets their **existing** account (no duplicate). Supabase's docs describe this for OAuth sign-in; for `signInWithIdToken` it is described in a 2023 Supabase announcement, but we could not confirm it from the docs alone. **Test it** (step 5 below). If a duplicate were ever created, switch back (rollback below) and tell Kenny.

## Steps for Posi, in this order

### 1. Google Cloud Console
1. Open https://console.cloud.google.com, choose the project, then **APIs and Services > Credentials**.
2. Open the existing **OAuth 2.0 Client ID** of type *Web application* (the one Supabase uses).
3. Under **Authorized redirect URIs**, click **Add URI** and add **both**:
   - `https://joinascentor.com/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
4. **Keep the old Supabase address** in the list for now (it ends in `.supabase.co/auth/v1/callback`). Do not remove it yet. Save.
5. On the same page, copy the **Client ID** and the **Client secret**. Do not paste them into chat or email.

### 2. The consent screen: make Google say "Ascentor"

This is controlled in Google Cloud Console, **not in code**. Nothing in the app can change what Google writes on its own screen.

1. Open https://console.cloud.google.com, choose the project, then **Google Auth Platform > Branding** (older consoles: **APIs and Services > OAuth consent screen**).
2. **App name:** `Ascentor`. This is the name Google shows ("to continue to Ascentor").
3. **User support email:** an Ascentor address. Google only allows an address the signed-in Google Cloud user owns, **or a Google Group that user manages**. Easiest: create a Google Group (for example `support@joinascentor.com`) at https://groups.google.com, make the Cloud user an owner, then pick that address here. Until that exists, keep the current one.
4. **App logo:** the Ascentor logo, square, at least 120 x 120 px. Google only shows a logo once the branding is verified.
5. **Application home page:** `https://joinascentor.com`
6. **Application privacy policy link:** `https://joinascentor.com/privacy`
7. **Application terms of service link:** `https://joinascentor.com/terms`
8. **Authorized domains:** add `joinascentor.com`. If Google asks you to verify the domain, do it in Google Search Console (https://search.google.com/search-console) with the same Google account.
9. **Developer contact information:** an Ascentor address (a Google Group works here too).
10. Save. Then open **Audience** and set the publishing status to **In production** so any Google account can sign in.

**Will it say Ascentor straight away? Not necessarily.** For an app that only asks for the basic scopes (`openid`, `email`, `profile`, which is all this app asks for), Google does not review the scopes. But when you add a logo or change the app name, Google can hold the new branding back until it has verified it, and **until then the screen may keep showing the domain (joinascentor.com) or the old name**. To get it shown, open **Google Auth Platform > Verification Center** (or **Branding**) and press **Submit for verification** if the button is offered, then wait for the email. How long that takes is Google's decision; we cannot promise a date or a result.

**What we could not verify from here:** the current branding/verification status of your project, and whether Google will accept the logo and domain. Only someone signed in to the Cloud Console can see this. **How Posi can check:** in **Google Auth Platform > Verification Center** the status reads *Verified*, *Needs verification*, *In review* or *Action required*, with the reason next to it. Then open the sign-in in a private window to see what people see.

Google shows each person's *own* accounts in the "Choose an account" list. That is normal and cannot be changed.

The pages Google links to open without signing in and are public: `/privacy` and `/terms` (checked: both answer 200 for a signed-out visitor).

### 3. Vercel (Ascentor project, **Production and Preview**)

**`GOOGLE_OAUTH_CLIENT_SECRET` must be a secret, not plain configuration.** Anyone who has it can pretend to be the app to Google. Treat it like a password: set it as a **Sensitive** environment variable.

1. Vercel > the Ascentor project > **Settings > Environment Variables > Add**.
2. Name `GOOGLE_OAUTH_CLIENT_SECRET`, paste the value, tick **Production** and **Preview**.
3. Turn on **Sensitive** (the toggle under the value) before saving. A sensitive variable can never be read again in the dashboard or the CLI, only replaced; that is what you want. If it is already saved without it, delete it and add it again with Sensitive on.
4. Never put it in chat, email, a screenshot or a file in the repo.
5. `GOOGLE_OAUTH_CLIENT_ID` is not a secret (it is visible in the Google address anyway), so a normal variable is fine.

What we checked in the code: the secret is read in exactly one place (the server-side callback, `app/api/auth/google/callback/route.ts`) and sent only to Google's token address; it has no `NEXT_PUBLIC_` prefix, so it is never sent to the browser; no log line prints it (the logs print only the kind of failure and the HTTP status); and `.env.example` contains only the variable name with no value.

| Name | Value |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | the Client ID from step 1 |
| `GOOGLE_OAUTH_CLIENT_SECRET` | the Client secret from step 1, **Sensitive** |

Redeploy afterwards.

### 4. Supabase (Authentication > Providers > Google)
- Keep Google **enabled** with the **same Client ID and secret**. `signInWithIdToken` only accepts a token whose audience is a Client ID listed here, so the Client ID in Vercel must match this one (if there are several, list them comma-separated in the Client IDs box).
- Leave **Skip nonce checks** off (the app sends a nonce, and Supabase must check it).
- Nothing else is needed. The Supabase redirect URL in this panel is only used by the old flow.

### 5. Switch it on and test
1. In Vercel add `GOOGLE_AUTH_MODE` = `custom` (Production and Preview) and **Redeploy**.
2. Open a **private window**, go to `https://joinascentor.com/login`, press **Continue with Google**.
3. You should see Google's account chooser saying **"to continue to Ascentor"** (or joinascentor.com), with **no Supabase address**.
4. Sign in with a Google account that has never used Ascentor: you should land on **onboarding**. Sign out and repeat with an existing member: you should land on the **dashboard** (or the page they were heading to).
5. Test an existing email/password account whose email matches a Google account: you should enter that **same** account (check the member list in admin shows one person, not two).
6. Press Cancel on Google's screen: you should return to `/login` with "You cancelled the Google sign-in".
7. Only when all of that works: go back to Google Cloud and **remove the old Supabase redirect URI**.

### Back button
Pressing Back after a Google sign-in returns to the page the person started from (`/login` stays `/login`, `/signup` stays `/signup`). The starting page travels in the signed state cookie, so cancel, errors and a state mismatch return there too. A signed-in person who lands on `/login` or `/signup` is sent on to their dashboard (or onboarding) by the server, with no flash of the form. In the Supabase mode the starting page is remembered in a short `ascentor_auth_from` cookie (just the word login or signup).

### Rollback (30 seconds)
Set `GOOGLE_AUTH_MODE` back to `supabase` (or delete it) in Vercel and **Redeploy**. The buttons use the old flow again. Because the old redirect URI is still in Google's list until step 7, this always works.

## Tested here, and not tested here
- **Tested locally** (with a stand-in for Google's token endpoint): the switch (off, custom without credentials, on), the redirect to Google with the right parameters, the cookie flags, same-site return paths, every refusal (no cookie, wrong state, expired, cancelled, Google refusal, Supabase refusal), rate limiting, the friendly messages on `/login`, and that the Google button goes to Supabase's address when the switch is off and to `/api/auth/google` when on. `scripts/visual/google_e2e.cjs` repeats it.
- **Not tested** (needs real Google): picking a real account, Supabase accepting a real Google `id_token` (including the nonce), a new user reaching onboarding, an existing user reaching the dashboard, and the account-linking behaviour. These are the checks in step 5.
- The hosting platform's own request log can contain the one-time `?code=` of the callback URL (the same as the old `/auth/callback`). The code is single use and useless without the verifier cookie and the client secret.
