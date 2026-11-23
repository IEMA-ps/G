# Store route and Back correction

Production was restored to the exact PR39 runtime after PR40's named routes failed. PR40 remains merged in git; this branch is the correction on top. No further production deployment until review and fresh approval.

## Route root cause
Cloudflare canonicalizes .html destinations. Rewriting /store/* to /store.html triggered a redirect to /store and lost the identifier. Use the canonical /store destination for the200 rewrite. Tested on actual non-production Cloudflare Preview, not only a local mock.

## Back
Public page has a visible Back button. Public preview links open in the same tab, rather than creating a tab that Back cannot leave safely. A direct entry seeds one home fallback history entry, so browser Back returns to the site home rather than closing. Same-origin entry preserves the previous page. This is one-time seeding, not a recurring Back trap; the user can still intentionally leave after returning home.

Authenticated clean-route entry seeds a dashboard fallback when opened directly. Existing navigation history saves merchant/order context, ignores repeated same-tab clicks, does not stack duplicate modal entries, and closes QR once on Back. In-app detail Back buttons use history and dashboard fallback instead of jumping to a hard-coded tab. Existing auth and role route checks remain unchanged. No auth, rules, offer or production data writes.

## Tests
15 root suites pass. Actual app history functions run in a local browser fixture: repeated tab/modal no duplicate, QR closes once, previous tab restored, different merchant/order contexts restored. Preview host pr41-store-back.3alababk.pages.dev tested direct browser Back, same-origin in-page Back, named URL exact retention, old ?id=, old name+token, older zero-code URL, invalid token safe unavailable state, mobile pixels. Preview reads existing public profiles only, no data writes or test records. PNG QR decode already passed PR40, no QR generation change in this fix. Share links now same tab only.

Source: https://developers.cloudflare.com/pages/configuration/redirects/
Preview: https://pr41-store-back.3alababk.pages.dev/store/iema-stor-G02-A227-T09~u6Y99guP2Sk-MogQADvxuhA

## Shorter share link and simpler QR window
New links use /s/G02A227T09~token. Name and code separators are removed. The full reversible token stays intact, with no truncated identity or new lookup collection. All prior /store and query links still resolve. No rules/data change. The QR window now has only its title, store name, link, QR, and copy/download/print actions. Code reference tables remain in STORE-LINK-CODES.md only. Requires fresh approval after screenshots.

Short-link Preview tested: https://pr41-store-short.3alababk.pages.dev/s/G02A227T09~u6Y99guP2Sk-MogQADvxuhA . New production-form URL is57 characters versus73 previously,16 fewer (22%). All41 runtime files will be byte-checked against this branch.
