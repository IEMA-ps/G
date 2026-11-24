# Terms page and signup consent, review only

No merge or production deploy until owner approval.

- `terms.html`: nine app sections transcribed from the delivered November 24 terms draft. Group rules and private owner notes are excluded. The page remains labeled draft, not legal advice. No payment phone number. A conditional note keeps marketer clauses from advertising an active program, offer or incentive.
- Email registration: unchecked, required checkbox and an explicit handler guard before any Firebase Auth create call. The terms open in a new tab without losing the form.
- Google: only a UID without an app profile gets an accessible native dialog after Google authentication and before profile creation. Acceptance is explicit and unchecked; cancel or Escape signs out without creating an app profile. Firebase may already have created a Google Auth identity, which this UI does not delete. Existing accounts are not prompted or assigned retroactive consent.
- Consent is saved as a separate `users/{uid}` self-update: version, server timestamp, and email/google method. This preserves the exact initial user-create schema. A failed save warns the user and does not claim a successful record. Current production rules and real Firebase writes were not tested. No Firestore rule deployment is included.
- This is a client-side gate, not tamper-proof enforcement or an immutable legal audit record. Strong evidence would need a server-controlled append-only record and owner-approved rules.
- A terms link is available from signed-out authentication and all signed-in role shells. Service-worker shell/cache version updated.

## Verification

Offline browser checks use the actual auth markup/handler plus isolated service stubs. No production account creation or customer messages.

- `node terms.browser.test.mjs`: unchecked email guard, opening terms preserves form, Google dialog accept/cancel/reset, nine sections, mobile overflow check, mobile/desktop screenshots.
- `node auth-policy.test.mjs`: existing role/balance preservation, new Google creation, canceled consent never creates profile, existing users not prompted.
- `node google-referral.test.mjs`: referral behavior preserved.
- Related password, routing and notification regressions also checked.

The text is a legal draft supplied for review, not a legal assessment. Review subscription refunds and platform liability with Egyptian counsel before final adoption.
