# Clean readable app routes, review only

New screen URLs use descriptive role paths, such as `/merchant/dashboard`, `/merchant/orders`, `/customer/home`, `/customer/orders`, `/admin/dashboard`, `/marketer/tools` and `/delivery/dashboard`. Auth paths are `/login` and `/register`. The domain and Firebase authDomain do not change.

## Compatibility
Legacy valid hash links are converted client-side with replaceState, retaining query parameters (marketer codes and store links included). Fragments are not sent to Cloudflare, so this conversion belongs in the browser. Notifications waits for the signed-in role. Unknown or wrong-role routes are not granted access and settle on that account's default screen. Actual permissions remain the existing role checks and Firestore rules.

Root-relative module imports, icons, manifest, QR script and public store links prevent nested-route asset failures. Marketer referral links now use `/register?marketer=...`, with old forms still accepted. Direct public `store.html?id=...` links are preserved. No new auth domains or OAuth scopes.

Cloudflare `_redirects` rewrites only `/customer/*`, `/merchant/*`, `/delivery/*`, `/marketer/*`, `/admin/*`, `/login` and `/register` to index.html with status200. It does not add a blanket rewrite for static files, store.html or Firebase auth paths. Include `_redirects` in the runtime ZIP. Cloudflare itself serves unknown paths as an SPA when there is no root404.html; this project already uses that behavior. No Cloudflare Functions were added.

The service worker's navigation fallback is now limited to app routes, with a bumped cache. PWA scope/start URL remain root. Existing modal/back behavior is retained. Screens needing a selected record (orderDetail/merchantPage) keep the current parent URL instead of publishing an unrecoverable record-less path.

## Verification
All11 local suites pass. Routes roundtrip for every role, malformed hashes do not throw, wrong-role routes are rejected, query parameters survive, and actual go/popstate/modal handlers are exercised. A real local browser test with the same rewrite rules verifies direct deep entry, refresh, navigation, Back/Forward, legacy hash conversion, marketer query preservation and no horizontal overflow at390/320. Preview screenshots use synthetic data and a clearly labeled URL display, not the live browser address bar. They are not production screenshots.

Cloudflare rewrite behavior is locally emulated and grounded in the official docs, not yet tested on a remote preview deployment. Final production verification after approval must open and refresh a real deep URL and check module responses. No production changes during this PR. No Firebase rule, setting, account, order, store or other data writes. Founding300 remains OFF.

Sources:
https://developers.cloudflare.com/pages/configuration/redirects/
https://developers.cloudflare.com/pages/configuration/serving-pages/

Fresh approval after screenshots is required before merge and deployment.
