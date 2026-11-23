# Growth review

Review only. No merge, deploy, outreach, production data changes, or offer activation.

## Marketer dashboard
Personal link/code and unique registered/paid-store totals. Paid means an APPROVED subscription with price > 0, excluding grantedByAdmin. Renewals count once. Missing/denied reads show unavailable, not zero. Counts refer to attributed store records, not visits or WhatsApp submissions. This is not a bank-payment receipt.

The existing WhatsApp code is parsed into an editable admin field. On save, exactly one MARKETER must match; the transaction rechecks role/code before atomically creating the PENDING store and linking its owner. No self-attribution, role promotion, or subscription activation. Existing admin attribution editing remains available.

## Theoretical EGP300 box
Per the later owner steer, remove the first50 count, progress indicator, areas, reservation engine, and all campaign schema/rule work. The offer remains a theoretical admin-only preview with an optional input that has no effects. It cannot change a price, attribute a merchant, submit a request, or take payment. No scarcity claim is shown. Existing EGP300 pricing logic/toggle are unchanged; toggle stays OFF. Merchant runtime does not display this theoretical preview even if the existing offer switch is later enabled.

Admin can preview the standalone card alongside normal subscription plans. Screenshots are clearly marked review-only. No fake performance or payment data is presented as production. No free-month invite system was added.

## Verification
Run auth-policy, member-roles, merchant-plans, merchant-welcome, support-requests, marketer-growth, founding-merchants tests. Emulator member-role suite uses the owner-supplied rules fixture and tests atomic reviewed marketer attribution plus rejected staff/customer bypass. No production records created. Mobile previews are isolated local fixtures.
