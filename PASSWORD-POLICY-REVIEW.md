# Password policy review

Review only, no merge or deployment until fresh approval after screenshots.

New passwords require at least8 characters, ASCII English uppercase, lowercase and a digit0-9. Symbols are allowed but not required pending clarification of the owner's extra word. Passwords are not trimmed. Applies to email/password signup, self-service password change, and the existing admin merchant-account create/reset paths. Login and current-password reauthentication are unchanged so existing short-password accounts are not locked out. Google sign-in is unchanged.

A small shared policy module returns Arabic missing-requirement errors before any auth mutation. Signup/new-password change show hints and a checklist. Existing admin password suggestions use browser crypto and the same validation. No real passwords are generated or changed during testing.

## Server-side enforcement still required
This PR enforces the policy in this app's forms, not across every possible Firebase API client. The owner must configure Authentication > Settings > Password policy in Firebase Console: minimum8, uppercase, lowercase and numeric required. Symbols optional unless confirmed. Review enforcement mode carefully and do not force existing users to upgrade on sign-in without separate approval. The hosted reset-password page and direct client calls need Firebase's policy rather than this local UI.

Official source inspected: https://firebase.google.com/docs/auth/web/password-auth
No console settings, Firebase rules, user accounts or passwords changed by this PR. No new paid service needed or enabled.

## Tests
password-policy.test.mjs verifies conditions, optional symbols, Arabic errors, no signup mutation for weak input, no reauthentication/update for weak new password, and acceptance of existing weak current password for reauthentication. All existing app unit suites remain passing. Screenshots are isolated local previews with synthetic checklist states, no production users.
