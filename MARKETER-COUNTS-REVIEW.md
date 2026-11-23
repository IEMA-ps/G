# Direct marketer counts + Google invitation code

Review only on main 329dc6d. No merge, deployment or production data changes.

- Each marketer card now places current CUSTOMER and other current MARKETER accounts side by side, splitting fixed and legacy evidence for each.
- Only direct signup code attribution (signupAttributions or older referredBy) is counted. Fixed records win over conflicting legacy records. Self, deleted and duplicate accounts are excluded. Indirect recruits and pending marketerJoinRequests are not counted. If an invited account later becomes MARKETER, it moves from the customer count into the marketer count. There is no retroactive backfill for missing attribution.
- This is a read-only report, not financial eligibility or verified real-world recruitment. No commission or appointment decisions change. Existing staff privacy gates and partial-data warnings remain.
- Google signup captures the typed invitation code before opening the popup, normalizes it and uses it for NEW profiles only, ahead of the link's marketer parameter. The Google handler owns profile bootstrap and awaits it, keeping the captured code alive until attribution completes. The auth-state callback skips that in-flight Google bootstrap. Failure/cancellation clears the per-attempt value; existing accounts are not re-attributed. No persistent browser storage of pending referral codes.
- No new rules, indexes, collections or permissions. Uses the rules the owner published after PR47. Fixed signup creation still follows the existing marketer-program gate; invalid/non-unique codes are rejected by the existing writer. Typed invalid code does not silently fall back to another inviter.
- 23 ordinary root test suites and browser UI smoke pass. New tests exercise actual Google popup and boot handlers (typed precedence, link fallback, existing account, cancel cleanup) and direct marketer count edge cases. Fake-data 390px and desktop review uses real admin functions. No real Google signup or production writes performed.

Deployment only after new owner approval. Add no new runtime assets: use updated index.html, admin-panel.js, admin-panel.css and sw.js. Exclude all review/build/test/docs files. PR45 remains separate; reconcile its overlapping index.html and sw.js copy changes later. No rules file needs resending or republishing for this PR.
