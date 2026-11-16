# BookIt on Google Play

The Android app is a Trusted Web Activity (TWA): a thin Android shell that opens the live game at
`https://anthonymcguigan.github.io/bookit/index.html?src=play` in Chrome, full screen. There is no separate Android codebase.

- `?src=play` (or an `android-app://` referrer) turns on Play mode in the game (`PLAY` in index.html).
  Play mode sells nothing and links to no checkout or tip page, because Google requires Play Billing for
  digital goods sold inside a Play app. Supporter perks bought on the web still work after sign-in.
- Build the app with PWABuilder (https://www.pwabuilder.com) or Bubblewrap. Package id: `com.bookitsim.game`.
  Start URL: `/bookit/index.html?src=play`.
- `assetlinks.json` here is a template. Fill in the SHA-256 fingerprints from Play Console
  (Setup → App signing) and publish it at `https://anthonymcguigan.github.io/.well-known/assetlinks.json`
  (the root of the domain, so it lives in the `AnthonyMcGuigan.github.io` repo, not this one).
  Without it, the app shows a browser address bar.
- Privacy policy for the store listing: `https://anthonymcguigan.github.io/bookit/privacy.html`.
