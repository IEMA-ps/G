# Named store links and local QR

Review only. No merge/deploy before screenshot review and explicit approval. No production data writes or rules changes. Founding300 OFF is untouched.

## Link design
/store/name-G02-A227-T09~stable-token resolves directly to the existing publicMerchantProfiles document. The token reversibly encodes the full existing ID, no truncation or hash collisions. UUID merchant IDs use a compact22-character base64url encoding plus a format marker. Legacy/custom IDs use lossless base64url with a separate marker. The readable name supports Arabic and English. Duplicate names cannot resolve to the wrong store because the full ID is encoded. Changing the name creates a new readable link but old links/printed QRs still resolve to the same store. This is a name plus stable code, not a name-only vanity alias. Name-only aliases need a reserved-name registry and rules, which is intentionally not added.

Proposed IEMA Stor example, not yet live:
https://3alababk.com/store/iema-stor-G00-A000-T09~u6Y99guP2Sk-MogQADvxuhA

Legacy /store?id= and /store.html?id= remain supported. Existing status/subscription/public-profile checks are preserved. No private merchant-list search, data migration or new public fields. A scoped Cloudflare /store/* rewrite serves the existing store page. Assets/imports and ordering backlink are root-based so nested paths work. Copy on the public page now copies the current named URL.

## QR
Merchant profile and admin merchant cards open the same share panel: preview, copy link, download1200px PNG, print store name plus QR and URL. The existing local MIT QR library is reused. No QR web service or customer data sent externally. Black on white, four-module quiet zone, error correction M. Arabic URLs are percent-encoded as ASCII for reliable QR encoding. QR contains only the public link. Inactive/unpublished pages remain unavailable even when a QR is generated.

## Verification
14 root suites, inline module syntax and diff check pass. New tests cover exact ID roundtrip, duplicate names, renames, Arabic/English, legacy URLs, malformed routes and both share controls. Local browser checked390/320 without horizontal overflow, actual download PNG and print document generated. QR images for English/Arabic and actual PNG download independently decoded with ZXing. Screenshots use the actual share module with a local-only domain override to show the proposed production URL, not a live deployment. Existing public profile protections unchanged. No rules patch required.

## Governorate, area and activity codes
Per user choice, links carry stable app codes G01..G27, A001..A415 (410 existing IDs, some gaps), T01..T16. Full frozen tables in STORE-LINK-CODES.md, interactive tables in share panel. Not official postal/administrative codes. G00/A000 are missing or custom area, T00 missing type and T99 custom activity. Exact structured fields or the app-generated address prefix are read, never guessed from legacy free text. IEMA public profile last read has only a free-text Sheikh Zayed address, so its truthful example is G00-A000-T09. A structured Giza/Sheikh Zayed store uses G02-A227-T09. Tokens and old name-only-plus-token URLs still resolve regardless of these decorative codes. No source lists are renumbered; new codes must be appended without reassignment.
