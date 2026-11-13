# Ascentor on iOS and Android

Status: groundwork in place on the `feat/native-apps` branch. Nothing is in a store yet.

## How the apps work

The iOS and Android apps are thin native shells (Capacitor 8) around the live site. The shell opens
`https://joinascentor.com/dashboard` in a full-screen WebView, so:

- every web deploy reaches the apps straight away, with no store release;
- a new app build is only needed when the shell itself changes (`capacitor.config.ts`, `android/`,
  `ios/`, a native plugin, the icon or launch screen);
- sign-in, sessions and data are exactly the web ones (same cookies, same API).

| Piece | Where |
|---|---|
| Shell settings (app ID, site address, launch screen) | `capacitor.config.ts` |
| Screen shown with no connection (bundled in the app) | `mobile-shell/app-offline.html` |
| Android project | `android/` |
| iOS project | `ios/` |
| "Am I inside the app?" for web code | `lib/native.ts` (`isNativeApp()`, `nativePlatform()`) |
| Launch hand-off, status bar | `components/MobileInit.ts` |
| Native push (off until configured) | `lib/mobile-push.ts`, `NEXT_PUBLIC_NATIVE_PUSH` |
| Cloud builds | `.github/workflows/mobile-build.yml` |

App ID (both stores): `com.joinascentor.app`. It cannot be changed after the first store upload.

## Building

Builds run on GitHub Actions; nothing needs to be installed locally.

- Actions tab, "Build mobile apps", Run workflow (or push a change to the shell).
- Android: download the `ascentor-android-debug` artifact and install the APK on an Android phone.
- iOS: the workflow only proves the project compiles. A build you can install needs the Apple
  Developer account (below).

To test the shell against a local dev server: `CAP_SERVER_URL=http://<your-ip>:3000 npx cap sync`.
Never ship a build made that way.

## What the web app does differently inside the apps

- The splash plays on app open and on return after 5+ minutes (same rule as the installed PWA).
- Settings, "On this phone": no install instructions; push shows as coming soon until native push is on.
- Web push (service worker) is not used; native push replaces it.

## Before the apps can go to the stores

Accounts (owner action)

1. Apple Developer Program, 99 USD a year, enrolled as an organisation (needs a D-U-N-S number).
2. Google Play Console, 25 USD once, as an organisation (skips the 12-testers-for-14-days rule that
   applies to new personal accounts).

Decisions

3. Payments inside the apps. Apple and Google require their own billing for digital subscriptions
   bought in an app, and signup currently takes a card through Paystack. Pick one:
   store billing in the apps, or sign-in-only apps with plans bought on the website.
   The shop (physical goods) can keep Paystack either way.

Build work still to do

4. Native push: Firebase project, `google-services.json`, Apple push key, server sender in
   `lib/push.ts` (`sendFCMPush` is a stub), then set `NEXT_PUBLIC_NATIVE_PUSH=1`.
5. Google and LinkedIn sign-in open the phone's browser, so they do not sign the app in. Needs native
   Google sign-in, and Sign in with Apple on iOS (Apple requires it beside any social sign-in).
6. Calls: test Daily audio and video on real phones, including with the screen locked.
7. Links: app links and universal links, so a `joinascentor.com` link opens the app
   (`/.well-known/assetlinks.json` and `apple-app-site-association`, which need the signing details).
8. Android release signing: create the upload keystore and add the four `ANDROID_*` secrets listed
   in the workflow file.
9. iOS signing and TestFlight upload in the workflow, once the Apple account exists.
10. Store listings: screenshots, descriptions, privacy answers (data collected, admin access to
    member conversations), a reviewer test account. In-app account deletion already exists.
