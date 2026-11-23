# Store activity picker, review only

"Type" means the store business activity, not the subscription plan. The app already stores activityType and displays it on cards/public profiles. Product categoryIds stay untouched.

A shared16-type list plus Other is used at registration by admin create, marketer create, customer merchant request and member-to-merchant creation. Includes perfumes. New stores must choose explicitly, no silent restaurant default. Existing arbitrary activity strings open as Other and retain their value. Existing stores without a type keep working and show "غير محدد". No batch migration or data writes.

Customer account signup remains CUSTOMER-only. Merchant signup remains the existing reviewed WhatsApp request workflow, now with a picker. This change does not restore the removed direct merchant account signup or auto-send requests.

The store list filter applies after the existing region logic. It filters stores only, not products or offers. All types is the default, missing types have their own option, and a filter unavailable in the current region is ignored rather than hiding everything. Activity remains visible on store cards/profile/public page.

## Registration only, no rules change
At the user's request, the type is selected only when creating/requesting the store. Merchant edit displays the saved type read-only, with an explanation. saveMerchantEdit never reads or writes activityType, including on legacy stores without a type. Existing missing values remain unchanged. Admin creation still selects the type; no new admin edit control was added.

The previously proposed owner-update rules patch is withdrawn and removed. Do not publish the earlier rules attachment. The current PR38 map-link rules already reject type changes by owners and are kept unchanged. The updated emulator test verifies owner edits/clearing are denied while normal store edits succeed. No rules publication is needed for this feature.

## Verification
13 local root suites pass, including type list/Other, legacy custom values, escaping, required validation, missing types, filtering and four registration entry points and read-only owner edit. Browser uses the actual edit form with synthetic data at390/320 with no overflow. Screenshots are local previews, not production. Rules tests are in store-types-emulator.fixture.mjs, run with the existing auth-emulator dependencies/server.

No merge/deploy before screenshot review and explicit approval. No production data changes. Founding300 stays OFF. Google location link behavior from PR38 is unchanged.
