# Marketer appointment and weekly incentive, review build

Not deployed to production. MARKETER_PROGRAM.enabled is false and settings.marketerProgramEnabled must also be true before operations work. No Functions deployment, billing change, production records, payouts or rules publication are part of this PR. The owner reviews screenshots and this PR first.

## Appointment
A customer has a reversible full-UID candidate referral link, distinct from merchant acquisition links. A signed-in CUSTOMER with a verified email explicitly confirms one immutable marketer join request through that link. A request cannot refer to itself or be reattributed. Five different request document IDs qualify the candidate for manual appointment by the main admin. The five people do not need to be appointed themselves, avoiding a recursive condition. Existing marketers keep their role. A main-admin exception requires a reason of at least10 characters, stored with the appointment. The role update and immutable appointment evidence are atomic. No automatic promotion or hidden self-promotion path is added.

Email verification proves mailbox access, not five distinct humans. The main admin still reviews suspicious accounts. The existing app's broad signed-in user reads are inherited and not expanded by this feature.

## Weekly incentive
One common future period is created by the main admin with a start time entered in Cairo time, a7-day end, and an explicit integer target. Five is the first-period default. A transactional schedule lock prevents overlapping periods and period edits. Each later period needs an explicit target. During a Cairo DST change, the fixed168-hour interval can end one local clock-hour different; the UI displays exact start/end in Cairo. Do not imply a calendar Saturday-Friday week.

Count distinct stores whose first approved, paid, non-free subscription falls in the period. Renewals of that store do not increase the target. All the marketer's paid approved subscription commissions within the period are eligible for the multiplier, including renewals, per the owner's decision that it applies to all subscription commissions that week. First-conversion detection uses the available full marketer-attributed subscription history. Reassignment or missing older history requires admin review, not a zero-assumption.

Base percent/amount are stored when new subscriptions are approved. Historical approved subscriptions lacking this snapshot are flagged for review, not guessed or rewritten. Existing base/tier commission accounting is left intact. End-period top-up equals max(0, base rate×1.5 commission minus the commission already credited) per transaction. This replaces rather than stacks a tier bonus. If an existing tier credit is larger than the target multiplier, no clawback is made. Rates cap at100%. The main admin must check the payment evidence and the arithmetic before crediting.

The incentive card is visible to every marketer, shows progress, potential top-up and locked status. Reaching the target changes it to achieved, waiting for period end. Only after period end and main-admin verification is a deterministic period+marketer record created once. Only these committed incentive records enter the withdrawable balance. Ordinary commission is not blocked. Main-admin-only payout approval remains enforced by UI and the proposed rules. No automatic transfer of money occurs. Existing withdrawal limits are not silently changed by this PR, including any distinction between the previous pilot300EGP decision and live settings.

## Security and activation
marketer-program.rules.fragment adds separate immutable records. tests/marketer-program/tests/marketer-program/integrated-review.rules is an emulator integration fixture built on the last owner-provided rules, NOT a verified fresh production rules export. Do not paste it over current rules blindly. Read and diff the current live rules first, then merge the fragment plus the three modifications listed below, run the tests again, and have the owner publish.

1. users create: an admin cannot bypass the appointment gate by creating a MARKETER directly. users update: main-admin role promotion to MARKETER requires the matching atomic appointment proof.
2. withdrawals update/delete: main admin only, replacing the broader staff-admin allowance.
3. marketerPayouts writes: main admin only.

Rules deny marketer/staff creation of incentives, reject pre-period-end and below-target records, and make credits immutable and deterministic. The trusted main admin verifies the underlying subscription evidence and calculation. Rules cannot aggregate an arbitrary subscription query, so this is administrative verification protected by server-enforced rules, not a Functions-computed ledger. No claim is made that these rules make the inherited client-side commission/withdrawal system a fully secure financial ledger. Before enabling real payouts, audit that existing system separately. Do not enable a backend or accept billing to work around this constraint.

Activation is a separate reviewed code/config change after the owner publishes the merged rules and permissions are checked. This PR remains fail-closed and cannot write new program records, appoint marketers, create periods or credit incentives while disabled. The demo page uses fixed fake data and never initializes Firebase.

## Tests
- All16 root suites, module/script syntax and git diff checks.
- Unit coverage: full-UID candidate token, no duplicate/self counting,5-proof and exception paths, seven days and boundaries, free grants and zero prices excluded, renewals, missing base snapshot, multiplier cap, no tier stacking, lock states.
- Firestore emulator: verified immutable requests, self/forged identities denied, atomic main-admin appointment, duplicate proofs/short exceptions/direct promotion denied, immutable non-overlapping periods, main-admin-only end-period deterministic credit, duplicate/mismatched/private reads denied.
- Visual review at390px of locked, achieved, candidate, join confirmation, admin exception and credit review states. Demo screenshots are fake-data review, not live financial results.

Emulator command after installing firebase-tools, firebase and @firebase/rules-unit-testing and Java21: `firebase emulators:exec --only firestore --project demo-marketer-program --config tests/marketer-program/tests/marketer-program/firebase.json 'node tests/marketer-program/tests/marketer-program/rules.test.mjs'`.
