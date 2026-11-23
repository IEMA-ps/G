# Store Google Maps link, review only

Replace manual latitude/longitude inputs with one optional Google Maps link and a map below it. The edit form, admin create form, marketer create form and member-to-merchant create form share the same field. Existing customer location/nearby behavior is unchanged.

## Compatibility and honesty
- Existing valid latitude/longitude generate a link and preview in memory. No batch migration or production data writes.
- Saving an unchanged legacy-derived link preserves the original coordinates exactly. A changed parseable link updates both coordinates. A changed opaque/short link clears stale coordinates so the old point cannot masquerade as the new location. Clearing the field removes the saved link and coordinates on explicit save.
- New googleMapsUrl takes priority in customer-facing map links and is included in the public profile projection. Existing address-only fallback stays a search link, never a claimed exact pin.
- Coordinates are extracted only from explicit query coordinate pairs, coordinate paths or Google place pin !3d/!4d data. @lat,lng is a camera center, not trusted as a place pin.
- Short maps.app.goo.gl / goo.gl/maps links are stored and opened unchanged. The browser does not expand them through a third-party proxy. No guessed map is shown. The form explains how to open Google Maps and copy a full coordinate/embed link.
- HTTPS Google Maps hosts/paths only, no credentials/ports, maximum4096 chars. Escaped attributes, no pasted iframe HTML or arbitrary URL embedding.

## Map service
The key-free consumer map iframe uses maps.google.com/maps?q=coordinates&output=embed, or an existing Google Share embed link. Google does not document the generated consumer URL as an API contract and could change it. The documented Embed API requires an API key. The map includes an external open link and fallback wording. No Cloud project, billing, keys or paid API added. The notice explains that a map preview contacts Google with the store location. It does not send phone/account/customer information.
Sources inspected:
https://support.google.com/maps/answer/144361
https://developers.google.com/maps/documentation/embed/embedding-map
https://www.timonforrer.ch/writing/2024/lightweight-google-maps-input-for-sanity/

## Firestore release dependency, do not skip
The user-supplied published.rules fixture has explicit owner-update/public-profile field lists. Emulator proves it rejects googleMapsUrl. firestore.store-map.proposed.rules is a proposal against that supplied snapshot, NOT verified current production state and NOT an instruction to overwrite production rules. Before release, retrieve current rules, review only the map-field diff, re-run tests, and obtain approval for that scoped rules change. The current Console read redirected to sign-in, so current published rules remain unverified. No production rule change was made.

The proposal adds the map field to the existing owner update allowlist, registration/public projection allowlists and public-to-merchant equality check. It adds HTTPS Google Maps URL validation without altering role, subscription, order, payment or private-data access. Admin permissions remain as before. It includes coordinate fields for marketer registration when derived from a pin.

## Verification
12 root local test suites pass, including real save-handler tests, legacy preservation, link priority, scheme/host/range validation and short-link behavior. Emulator tests compare the supplied old rules (expected rejection) with the proposal (owner save/public projection allowed; other user, unsafe URL, forged projection and plan edit rejected). Browser renders the actual edit-form function with synthetic data, actual Google map iframe,390/320 no horizontal overflow. Screenshots are local previews, not production, and no Save action writes anywhere.

No merge, deployment or rule publication before screenshot review and explicit approval. Founding300 remains OFF. No production data writes.
