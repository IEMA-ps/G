# Batch 2: marketer tools and phone installation

All changes are on the draft review branch. Nothing is merged to main or deployed to production by this batch. Preview deployments use the existing shared Firebase backend, so test sign-ins still touch that shared test user's profile.

## Available without a new server deployment
- Marketer signup link with code prefilled for merchant registration.
- WhatsApp, Facebook and device share composers. No automatic sending or posting.
- Three Arabic pitch templates with copy/open-in-WhatsApp actions.
- Locally generated QR SVG and branded 1080x1080 post / 1080x1920 story PNG downloads.
- Desktop navigation aligned with the app instead of displaced to the left.

## PWA phone installation
- Fixed existing broken icon paths in the manifest, page and service worker. Existing 192/512/maskable/iPhone icons are reused.
- Arabic standalone manifest, theme and background colors retained.
- Arabic install button uses the native browser prompt where supported. Manual Safari/iPhone and other-browser instructions explain Add to Home Screen.
- Service worker caches only the public same-origin shell. It does not cache Firebase requests or private account data. Orders, authentication and full app startup still need internet. This is not a native APK or an app-store submission.
- Removed placeholder YOUR-DOMAIN metadata in favor of the current production hostname.

## Prepared, not enabled
- Server-side visit counting, own-account metric reads, approval/first-order inbox notifications, opt-in alias leaderboard.
- marketing-config.js keeps backendEnabled=false. No made-up or provisional metrics are shown.
- MARKETING-BACKEND.md lists the access, rules, billing, emulator, backfill and deployment checks that must happen before enabling. No billing or existing Firestore-rule changes were made.
- These notifications are inside the app, not background push notifications.

## Verification
- Isolated browser regression suite passed: default fields, preserved fields, tier progress 0/5/10/30, existing plan rates, category aliases, home search reset and full logout reset.
- Both exported PNG QR codes decoded to the correct production signup link. Dimensions checked as 1080x1080 and 1080x1920. UI and PNG pixels inspected.
- Chrome DevTools installability test in a normal persistent browser profile returned no manifest or installability errors against the exact source. All 12 shell resources cached successfully. No page JavaScript errors in this test.
- Live HTTPS preview: signed in with the existing marketer test account, correct code/link and QR visible, desktop nav boundaries match the app. Manifest icon URLs return 200 image/png and service worker is activated.
- Physical Android and iPhone installation is not tested. Server functions have syntax checks only, not emulator/deployment verification yet.
- GitHub branch file bytes verified against the local tested source. No commission rates, payout rules, live catalog migration, account deletion or production release was performed.
