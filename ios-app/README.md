# BookIt on the App Store

The iPhone app is a [Capacitor](https://capacitorjs.com) app. The whole game (the same `index.html` as the
website) is bundled inside it, so it opens offline from the first launch. There is no second codebase:
`npm run sync` copies the current game into the app before each build.

What is different inside the app (all in `index.html`, look for `IOS` and `NATIVE`):

- **Supporter for life through Apple** ($7.99, product id `bookit_supporter_life`) via RevenueCat. No Stripe
  links and no tip link in the app. Guests can buy without an email. **Restore purchases** is on the Supporter page.
  Perks bought on the website still work in the app after sign-in.
- **Sign-in by 6-digit code** instead of an email link, because links open Safari, not the app.
- **Delete my account** in Community → Profile (Apple requires it), using `delete_my_account()` in `supabase/setup.sql`.
- **Block** a Community creator (Apple requires blocking for user content), plus Unblock all.
- Haptics on the opening bell, finishes and drag moves; save backups go to the iPhone share sheet.
- No service worker (the files are already on the phone). Play stats count the app as "app".
- iPhone only, portrait, dark status bar. Bundle id `com.bookitsim.game` (same as Android).

Open `index.html?src=ios` in a browser to see the iPhone screens without the app.

## One-time setup (Anthony)

1. **Apple Developer Program**, $99/year: https://developer.apple.com/programs/enroll/ (individual is fine;
   the seller name on the store will be your legal name, or enrol as an organisation for a company name).
2. **App Store Connect** → Apps → + New App: iOS, name "BookIt: Wrestling Booking Sim", language English,
   bundle id `com.bookitsim.game` (register it first under Certificates, Identifiers & Profiles), SKU `bookit-ios`.
   Then Agreements, Tax and Banking → accept the Paid Apps agreement and add bank + tax details (needed to sell).
   Join the **App Store Small Business Program** so Apple's fee is 15%, not 30%.
3. **The in-app purchase**: App Store Connect → your app → Monetization → In-App Purchases → +
   - Type **Non-Consumable**, reference name "Supporter for life", product id `bookit_supporter_life`.
   - Price $7.99 (tier), display name "Supporter for life", description "Extra cloud slots, a gold badge and more Community space."
   - Review screenshot: `app-store/supporter-review.png` from the project files (or a screenshot of the Supporter page).
4. **RevenueCat** (free until $2,500/month in revenue): https://app.revenuecat.com
   - New project "BookIt" → add an **App Store** app with bundle id `com.bookitsim.game`, and upload an
     **In-App Purchase key** (App Store Connect → Users and Access → Integrations → In-App Purchase → generate, download the .p8).
   - Products → add `bookit_supporter_life`. Entitlements → add `supporter` and attach the product.
   - Copy the **public Apple API key** (starts `appl_`) into `RC_IOS_KEY` in `index.html`, and the app's
     Apple ID number into `IOS_APP_ID`. Both are public, safe to commit.
   - Integrations → Webhooks → URL `https://svqfswhnesaglciviprw.supabase.co/functions/v1/revenuecat-webhook`,
     Authorization header: a long random password you make up. Environment: both.
5. **Supabase** (dashboard, by hand):
   - SQL Editor: run the "Delete my account" block at the end of `supabase/setup.sql`.
   - Edge Functions → Deploy new function named `revenuecat-webhook` with the code in
     `supabase/functions/revenuecat-webhook/index.ts`, **Verify JWT off**.
     Secrets → add `REVENUECAT_WEBHOOK_AUTH` = the same password as the RevenueCat webhook.
   - Authentication → Emails → **Magic Link** and **Change Email Address** templates: add the code, e.g.
     `<p>Or type this code in the app: <b>{{ .Token }}</b></p>`. The web link keeps working.
   - Authentication → URL Configuration → Redirect URLs: make sure `https://anthonymcguigan.github.io/bookit/` is listed.

## Building

### Option A: Codemagic (no Mac needed)

1. Sign up at https://codemagic.io with GitHub and add the `bookit` repository. It finds `codemagic.yaml`.
2. Teams → Integrations → **App Store Connect**: add an API key (App Store Connect → Users and Access →
   Integrations → App Store Connect API → +, role "App Manager"). Name it `BookIt App Store Connect key`.
3. In `codemagic.yaml`, set `APP_STORE_APPLE_ID` to the app's Apple ID number.
4. Code signing: Codemagic → Teams → Code signing identities → generate an Apple Distribution certificate and
   fetch the App Store profile for `com.bookitsim.game` (it can create both for you with the API key).
5. Start a build of `ios-release`. About 15 minutes later it is in **TestFlight**. Install TestFlight on your
   iPhone to try it, then submit from App Store Connect.

Codemagic's free tier gives 500 build minutes a month on Mac minis, plenty for this.

### Option B: a Mac with Xcode

```sh
cd ios-app
npm ci
npm run sync      # copies index.html, icons, sounds and fonts into the app
npm run open      # opens Xcode
```

In Xcode: App target → Signing & Capabilities → your team, then add the **In-App Purchase** capability.
Product → Archive → Distribute App → App Store Connect.

## Each game update

The app does not update itself from GitHub Pages. After a game update is merged:
bump `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` to the game's version, build again
(Codemagic does `npm run sync` for you), and submit the new build. Review usually takes about a day.

## App icon and launch screen

Made from `icons/icon.svg` into `resources/icon-only.png` (1024×1024, no transparency) and
`resources/splash.png`. To remake them: `npm run assets`.
