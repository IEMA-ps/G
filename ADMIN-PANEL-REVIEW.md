# لوحة الإدارة والأعضاء: للمراجعة فقط

Based on main c5be96ef0c8603b5922180c260759b142049706e (PR44 + PR46). No production writes, deployment, merge, incentive activation, or customer import.

## Design

- Warm brand retained, with a quieter off-white admin workspace, separate page headings, larger numbers, consistent cards, forms and buttons.
- Desktop sidebar groups all 17 admin pages. Mobile has four main destinations plus a scrollable full-page menu. Staff get 14 destinations, without settings, database or audit tools.
- Every admin route uses the scoped design system. Existing operational forms and actions stay in place. New-order and pending-merchant sidebar counts remain visible.
- Member search works by name, existing contact fields and referral code, alongside role filters and pagination. No new contact data is exposed.
- A separate customers-per-marketer view works even with the incentive program off. No totals affect commissions, payouts, appointments or eligibility.

## Counting semantics and limits

Counts are distinct currently-existing CUSTOMER user accounts, not visits, orders, lifetime acquisitions or merchants. A customer who later becomes a merchant or marketer is no longer a current customer. Each immutable signupAttributions document wins over that user's mutable referredBy legacy field, even when the two owners conflict. Missing/deleted accounts, self-referrals and repeated attribution IDs do not add customer counts. Marketers with zero customers remain visible. Only accounts currently in MARKETER role appear as report owners.

Current referralCode is shown for identification. Legacy data stores an owner UID, not a historical code snapshot. Code changes and legacy self-edits cannot be reconstructed. The UI labels fixed records and legacy records separately and warns that legacy records are not historical proof. A denied or loading fixed-record query never masquerades as a complete zero. Staff retain the existing users-collection access but cannot query fixed attribution records; their displayed total is explicitly partial legacy data.

No registration behavior changes: immutable records are still created only under the existing incentive-program conditions. The report does not retroactively create or backfill them.

## Rules handoff, owner publishes

firestore.admin-report.proposed.rules is a review snapshot based on PR46's proposed rules, not a claim about current production rules. The ONLY change from that snapshot is inside match /signupAttributions/{uid}:

    allow read: if isSuper();

This replaces the prior programEnabled() && isSuper() read condition. Creation and immutable update/delete restrictions are unchanged. This allows the main admin to read existing records without activating the incentive program. No new indexes required.

Before publishing, export the owner's latest live rules and apply only this one read-line change to the matching existing block. Do not overwrite unknown newer production rules with this snapshot. If the block is absent, reconcile the existing reviewed marketer rules with the owner first. Until the rules allow it, the UI will show an explicit incomplete-data warning. Never turn on incentives just to load this report.

## Tests and preview

- All 22 ordinary root .test.mjs suites pass (browser test is separate).
- admin-panel.test.mjs covers nav role gates, actual member renderer, search, deduplication, attribution precedence, missing users, role changes, escaping, empty/loading/error/legacy states.
- 11 Firebase Emulator assertions pass on the proposed full rules: main-admin reads while program off; staff, customer, marketer and anonymous reads denied; fixed records immutable; staff settings updates denied; existing staff member listing still allowed.
- Chromium fake-data UI tests pass at 390px and desktop, with width checks at 320/768/820/999/1000px. Tested real render functions for overview, members, code report, products and settings; full menu, search and staff gates. No Firebase SDK or production network is used by the review page.
- admin-panel-review.html is generated from real index.html render functions by node admin-panel-review.build.mjs. It contains fake names and example.test accounts only. Operational clicks are blocked in this review page. Not included in production uploads.

Reproduce pure tests: run node on each root .test.mjs except admin-panel.browser.test.mjs. For browser tests, install playwright locally, regenerate the review HTML, then run node admin-panel.browser.test.mjs (Chrome at /usr/bin/google-chrome, SCREENSHOT_DIR optional). For emulator tests, use catalog-emulator.package.json dependencies installed in the repository, then firebase emulators:exec --project demo-admin-report --only firestore --config admin-report-emulator.firebase.json 'node admin-report-emulator.fixture.mjs'.

## Deployment and overlap

Fresh owner approval after screenshots and PR review is required before merging or deploying. Runtime packaging must add admin-panel.js and admin-panel.css and use this sw.js/index.html. Exclude review HTML, build scripts, tests, rules and docs from the production ZIP. Cloudflare still needs a separate manual production upload after an approved merge.

PR45 is not touched or included. Shared files with it: index.html and sw.js. Its copy changes need a careful merge around the members screen and service-worker cache key/list. Admin styling and reporting live in new isolated files to limit overlap. No routing additions or changes.
