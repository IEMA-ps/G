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

For existing free-text paths the selected governorate/area are prepended to the existing address field only when the person saves. Without a selection the old address is kept as-is. No schema fields added to merchant/courier records; customer addresses retain their existing governorate/area schema. No migrations, existing-record edits, Firestore rules changes, fee changes or service-coverage changes. Choosing an area explicitly does not promise delivery. Founding300 remains theoretical and untouched.

## Checks
Nine local suites, syntax and whitespace checks. Location tests cover 27/410 counts, parent linkage, Arabic normalized search, zero results, wrong-parent rejection, custom fallback, legacy address preservation and the actual customer save handler rejecting invalid input before any write. 390/320 screenshots are isolated synthetic previews inspected visually, with no production data.

No merge or deployment until fresh approval after review.
