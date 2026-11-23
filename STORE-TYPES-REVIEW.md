# Store activity picker, review only

"Type" means the store business activity, not the subscription plan. The app already stores activityType and displays it on cards/public profiles. Product categoryIds stay untouched.

A shared16-type list plus Other is used by merchant edit, admin create, marketer create, customer merchant request and member-to-merchant creation. Includes perfumes. New stores must choose explicitly, no silent restaurant default. Existing arbitrary activity strings open as Other and retain their value. Existing stores without a type keep working and show "غير محدد". No batch migration or data writes.

Customer account signup remains CUSTOMER-only. Merchant signup remains the existing reviewed WhatsApp request workflow, now with a picker. This change does not restore the removed direct merchant account signup or auto-send requests.

The store list filter applies after the existing region logic. It filters stores only, not products or offers. All types is the default, missing types have their own option, and a filter unavailable in the current region is ignored rather than hiding everything. Activity remains visible on store cards/profile/public page.

## Rules dependency
The current map-link rules were confirmed and published by the user during PR38. They allow activityType in create/public projection but not in owner updates. firestore.store-types.proposed.rules adds activityType to that existing owner-update allowlist only. The emulator verifies the baseline rejects editing the type, the patch permits it and public projection, while other-user access, subscription/ownership edits and forged public activity are rejected. The user publishes this one-field rule change before frontend release. No production rule change was made by this PR. Compare with current Console rules before publishing, preserve any newer changes.

## Verification
13 local root suites pass, including type list/Other, legacy custom values, escaping, required validation, missing types, filtering and five form entry points. Browser uses the actual edit form with synthetic data at390/320 with no overflow. Screenshots are local previews, not production. Rules tests are in store-types-emulator.fixture.mjs, run with the existing auth-emulator dependencies/server.

No merge/deploy before screenshot review and explicit approval. No production data changes. Founding300 stays OFF. Google location link behavior from PR38 is unchanged.
