# Batch 1: marketer and round-2 fixes

## Changes
- Replaced the blocking native sign-out dialog with an in-app confirmation. Both sign-out buttons use the same async handler. Errors allow retry; successful sign-out clears all session data, listeners, modal content, and private rendered content, and opens the login tab. Async product reads from an old session are ignored.
- User creation, fallback user creation, admin marketer promotion, and the admin repair path add missing referralCode and loyaltyPoints. Existing values are kept. Login attempts to repair missing fields without changing roles. If Firestore denies that repair, the marketer sees an admin-repair message instead of an empty card.
- Bronze shows the subscription default numerically. Tier progress is real progress toward the next tier: 0/10 is empty, 5/10 is 50%, and the top tier is full.
- Commission amounts are unchanged. Per-plan rates are marked as custom or inherited. The live basic plan is explicitly 20%; medium and premium inherit the current 10% default. No money settings were changed.
- Supermarket aliases query both legacy category IDs. Stationery aliases show one label, أدوات مكتبية. The admin catalog tool previews product moves, archives duplicate categories, and can hide off-topic demo inventory only when tied to an explicitly identified demo merchant. It does not delete products or touch prices or real-merchant inventory.
- New demo seeding does not create clothing, electronics, or pet inventory, and no longer attaches demo products to the first real merchant.
- Going home resets search, including browser history navigation.
- Bumped the service-worker cache version.

## Verification
- JavaScript syntax check passed.
- Isolated Chrome tests using mocked Firebase and a current catalog snapshot passed: user defaults, preserving fields, tier progress at 0/5/10/30, unchanged 20/10/10 rates, two supermarket IDs, one stationery label, home search reset, sign-out and complete session reset.
- Inspected local mobile-width screenshots of the marketer dashboard and supermarket products.
- These tests do not prove production Firestore write permissions. No production deployment, catalog migration, account deletion, or money-setting update has been performed.

## Still separate
- The reports' claim that all 46 catalog items belong in supermarket was not supported by the live catalog. Only the three grocery products attached to the supermarket alias are merged; unrelated products are not misclassified.
- Deleting test Auth accounts, orders and addresses requires separate privileged Firebase access. No test account was deleted, including the account still used for marketer testing.
- Live verification of both sign-out entry points and of the missing-fields repair is needed after deploying the review branch.
