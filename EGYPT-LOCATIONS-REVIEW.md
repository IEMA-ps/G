# Egypt location lists, review only

The owner chose main cities/districts plus a manual fallback. No claim to list every village, hamlet or area in Egypt.

## Data
27 governorates, 410 linked city/area records, copied locally from https://github.com/useswype/egypt-geo-data at commit 10feac786ff1805e7de799c085a5878fa6ed58e5. MIT notice retained in EGYPT-LOCATIONS-LICENSE.txt. Arabic names, IDs and Arabic search aliases are retained. All parent links and unique area names within each governorate were checked. This is community-maintained data, not an official current boundary register. No remote API or ongoing service is needed.

## UI
A governorate selector, Arabic area search, filtered area selector and an explicit custom-area field. New customer addresses require a valid governorate plus a selected or manually entered area. Street/building/notes remain separate. Other existing address forms offer the picker optionally, so a legacy or pasted address is never silently parsed or overwritten. If a governorate is selected, an area must be completed. Forms covered:
- Customer new address.
- Customer merchant/courier join request.
- Admin new merchant/courier record from member management.
- Admin new merchant.
- Marketer new merchant.
- Merchant address editing.

For existing free-text paths the selected governorate/area are prepended to the existing address field only when the person saves. Without a selection the old address is kept as-is. Explicit selections use a labeled address prefix (`المحافظة: ... | المنطقة: ... | ...`) so matching never guesses from legacy prose. Re-editing replaces that prefix, rather than duplicating it. No schema fields added to merchant/courier records; customer addresses retain their existing governorate/area schema. No migrations, existing-record edits, Firestore rules changes, fee changes or service-coverage changes. Choosing an area explicitly does not promise delivery. Founding300 remains theoretical and untouched.

## Checks
Nine local suites, syntax and whitespace checks. Location tests cover 27/410 counts, parent linkage, Arabic normalized search, zero results, wrong-parent rejection, custom fallback, legacy address preservation and the actual customer save handler rejecting invalid input before any write. 390/320 screenshots are isolated synthetic previews inspected visually, with no production data.

No merge or deployment until fresh approval after review.

## Expanded request: signup and stores in the same area
Customer email signup now requires governorate/area, validates before creating the auth account, creates the exact original user schema, then updates `preferredLocation` separately. If that update fails the account remains valid and a toast asks the person to choose the area after login. Existing/Google customers can choose/change their area from the new store section on home/browse. No incomplete delivery address is created from a coarse preference.

Nearby means exact normalized governorate AND area match from the explicit labeled store address, not GPS distance. Home and browse show store cards for that area, plus an all-stores toggle. With no selected area or zero matches, all available stores are shown with an explicit notice. Legacy addresses are never guessed, migrated or deleted. The owner said he will remove old stores himself. Product listings remain all-store listings and are labeled that way; cart/order behavior stays unchanged.

`preferredLocation` is the only new saved user field. The supplied published.rules fixture permits self-updates while keeping create schemas strict. Emulator test verifies exact create-then-update, blocks another user's location update and blocks self-promotion. No live Firebase rules read or write claimed. Ten local suites pass. New previews show signup location, matched store cards and no-match fallback at 390/320.
