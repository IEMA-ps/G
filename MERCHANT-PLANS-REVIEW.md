# Merchant subscriptions v2, review before release

This branch is a review proposal. Do not merge, upload to Pages, enable the new catalog, or edit production data until Islam approves. It does not deploy Firebase rules or functions.

## Reviewed prices

| Service | 3 months | 6 months | 12 months |
| --- | ---: | ---: | ---: |
| Profile, location and contact numbers only | EGP 200 | EGP 400 | EGP 600 |
| Products, ordering and preparation for courier pickup | EGP 400 | EGP 800 | EGP 1,200 |

Ordering adds a merchant-paid 2% commission. Customers are not surcharged. Checkout remains cash on delivery. Subscription payments still use manual review. New plans do not advertise unlimited products or introduce an unapproved product allowance. Store products load in additional batches of 120 when needed.

## Calculation and renewal choices needing review

- The 2% base is merchandise after the merchant's product-price discounts, excluding delivery. Existing platform-funded order coupons and loyalty redemptions do not reduce the merchant's base. This preserves the existing funding distinction, rather than silently changing who funds discounts.
- Fee terms are stored on each new order. Only DELIVERED orders enter the monthly statement, using the actual server delivery timestamp and the Africa/Cairo month, not the order creation month. Orders without a delivery timestamp are flagged, never assigned to a guessed month.
- Monthly statements are read-only collection aids, NOT payment receipts or a ledger of paid/unpaid commission. No automatic debit, payout, money transfer, receipt, or refund is implemented. Rejected and cancelled orders are excluded. Subscription fees are shown separately from order commissions.
- Existing orders, saved weekly settlements, plan documents, merchant commission percentages and marketer rates are not migrated or recalculated. New-model orders are excluded from the old weekly payout calculation so the same order does not appear in both systems. Marketer order earnings use the snapshotted platform fee for new orders, with the same marketer percentage as before.
- Renewing the same new plan type adds the term after the existing expiry. Switching between profile and ordering, or moving a paid legacy term to the new model, waits until the old term expires. There is no silently invented proration policy. Month-end dates clamp to the last valid date.

## Profile privacy

`store.html?id=...` reads only `publicMerchantProfiles`, not user accounts or the full merchants collection. Only an explicit field whitelist is published: store ID, business name, description, public phone and WhatsApp numbers, address, optional latitude/longitude, logo, activity, hours, status, expiry and service type. No owner ID, username, account email, marketer attribution or financial record is copied. Profile fields are rendered with textContent. Links use normalized phone numbers, validated map coordinates and HTTPS-only logos.

The profile editor tells merchants which fields become visible to visitors. Profile-only merchants cannot use product/order screens, product creation, direct cart entry, recurring checkout, group-buy finalization or standard checkout. Standard, recurring and group orders re-read the merchant inside the order transaction.

## Catalog activation, intentionally manual

After all release checks and authorization, the main admin can preview the six plans in the subscription admin screen, then explicitly add them. Existing plans are not deleted or overwritten; old paid terms remain valid. The new catalog display is controlled by `settings/app.merchantPlansV2`. New-model merchants require a valid paid term independently of the old global optional-subscription switch.

Repeated activation reads deterministic plan IDs before creating missing plans. Subscription approval is transactional and re-reads the pending request, plan, merchant and settings. It rejects changed prices/terms and duplicate approval. Public profile publication is in the same transaction as activation. If permissions reject publication, activation cannot partially commit.

## Release blockers: Firebase authorization must be verified separately

The repository does not contain the deployed Firestore rules. Browser guards are not authorization. This branch deliberately does not invent or replace the project's rules.

Before ANY production activation:

1. Recover the current complete deployed rules and verify current role/owner bindings. An older broad allow cannot be fixed by adding a narrower deny.
2. Protect plans, settings, subscription approval, expiry, type, fee terms and public publication with the actual main-admin authorization. A merchant/customer must not be able to select its own paid service, lower the 2% base, change an approved amount or change another store's profile.
3. For `publicMerchantProfiles/{id}`, allow unauthenticated get only while the authoritative merchant document is ACTIVE with a valid new-model term. Verify the store matches the public document. Do not permit broad list access or copying private fields. Restrict writes to the authoritative owner/main admin, field whitelist and matching after-write merchant values. Suspension, deletion, expiry and ownership change must deny access immediately even if a copied public document is stale.
4. Validate every new order's merchant eligibility and immutable fee snapshot against authoritative data in rules or trusted server code. Validate delivery transitions and timestamps. Test direct writes, stale carts, duplicate approval, wrong-owner writes, cross-role reads and update-after-approval in the emulator.
5. Test public viewing signed out, expired/suspended stores, profile edits, activation rollback, and both merchant/admin statements against those real rules. The screenshots use isolated synthetic fixtures and do not prove production rules.
6. If `useBackend` is true, implement/review the new approval contract in the existing backend before activation. The client refuses to route new-model approval to the old function or silently turn the backend off. Do not enable billing or deploy paid services for this PR.
7. Confirm the calculation, migration timing and read-only statement scope above with Islam, then obtain separate merge/deployment approval. A final runtime ZIP must include `merchant-plans.js` and `store.html` along with the updated `index.html` and `sw.js`.

## Verification

- `node merchant-plans.test.mjs`: isolated plan prices, visibility, ordering eligibility, legacy compatibility, expiry boundaries, renewal restrictions, month-end dates, Cairo month attribution, server timestamps, cents rounding, phone and map links.
- Isolated browser tests stub all Firebase access. They check the compiled subscription screen, six prices, profile-only cart/product guards, public profile links/text escaping, monthly statement, atomic activation/replay/changed terms, and responsive layout. No production data or controls are used.
- Screenshots are synthetic review examples, not real merchants or performance data.
