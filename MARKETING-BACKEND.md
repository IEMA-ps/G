# Marketing backend, disabled pending deployment review

The frontend tools for sharing, templates, QR codes and PNG materials work without these functions. Notifications, leaderboard and visit metrics are intentionally disabled in marketing-config.js until this backend is deployed and checked. They are not production-ready merely because these files exist.

## Before enabling
1. Recover and review the project's CURRENT Firestore rules and existing functions. Keep role promotion admin-only. Make merchant attribution immutable after signup except through an authorized admin. Clients must not be able to edit the metrics, inbox, visit registry or public-stat documents. Explicit deny rules do not override a broad allow elsewhere, so inspect the whole ruleset.
2. Keep these new collections server-only: marketerCodes, marketerVisits, marketerMetrics (including subcollections), marketerInbox (including subcollections), marketerPublicStats. Clients use authenticated callables for their own results. No user-list reads are added by these tools.
3. Confirm project billing and deployment authority. Do not enable a billing plan or accept charges merely to deploy. The source uses a separate marketing codebase, so old function exports are not replaced.
4. Register the web app's production and approved preview hosts with Firebase App Check and a public reCAPTCHA v3 site key. Callables enforce App Check. The key is not a secret. Never put a service-account private key in the repository.
5. Merge the following composite index into the current deployed index configuration, without replacing unknown indexes: collection subOrders, fields merchantId ASC, createdAt ASC, __name__ ASC. The first-order trigger checks the earliest order, not the first event delivered to the function.
6. Configure Firestore TTL for marketerVisits.expiresAt. Visit records expire after 30 days. No IP, phone, email or contact-list data is collected by visit tracking. Visit counts are approximate browser sessions, not verified unique people or commission evidence.
7. Test with the Firebase emulators before deployment: duplicate/reordered merchant events, reassigning a store, suspension/reactivation, role demotion, opt-out, missing users, first order vs historical orders, duplicate visit IDs, missing/wrong auth and missing App Check. The trigger source has syntax checks only at this stage; emulator and production checks are still required.
8. Backfill existing MARKETER users' code registry and each currently attributed merchant's metrics using an authorized migration. Firestore triggers do not backfill old documents just by being deployed. Do not report zero initial metrics as real performance before the backfill is reconciled. Do not notify old approvals as if they just happened during backfill.
9. Deploy only the marketing codebase using firebase.marketing.json after reviewing the previous steps. Verify each callable's identity checks and result shape in a non-production environment. Then set backendEnabled and appCheckSiteKey in marketing-config.js. Keep the switch false until verified.

## Privacy and meaning
- The leaderboard is opt-in, off by default. It shows a generated marketer alias and the count of active stores, not names, phones, revenue or account IDs.
- The dashboard returns only the signed-in marketer's metrics and inbox. The leaderboard is available only to signed-in marketers.
- Visit IDs are random per browser tab/session and deduplicated for a code. They are not a full conversion funnel.
- Notification inbox entries are inside the web app, not operating-system push notifications. Background push needs a separate permission and delivery setup.
- Commission calculations, rates, payouts and withdrawal conditions are unchanged.
