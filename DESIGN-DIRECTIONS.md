# Visual directions for review, not production

Base: main ef6595ed21c06a45c2e77f4216038659ae732fc8.

Use ?design=a for the warm neighborhood direction, or ?design=b for the city-service direction. With no parameter the app keeps its original published appearance. Theme scripts only change visual assets, decorative category icons, CSS and install metadata. They do not alter account roles, prices, commissions, content, catalog records or transactions.

A: warm tomato and cream, IBM Plex Sans Arabic, generous curved surfaces, open product cards, floating navigation. New house/door logo.
B: midnight and citron, Noto Sans Arabic, defined product cards, compact squared controls, fixed utility navigation. New geometric door/arrival logo.

Each direction has an SVG mark, 192/512 icons, a maskable 512 icon, 180 iPhone icon and a direction-specific Arabic manifest. Existing copy is retained. All colors, spacing and typography are review proposals, not user-confirmed brand preferences.

Local mocked-Firebase rendering covers customer home, category browsing, product modal, cart, profile and marketer dashboard. Test screenshots use a catalog snapshot and demo account values. The home preview sets the snapshot's first six products as popular only in the test harness to expose the product-card treatment. No live product flags were changed. Some original product image links fail and show the app's normal fallback. Screenshots are not evidence of production data changes.

Still required before release: user direction choice; all-role screen-by-screen review; production font and image loading checks; touch/keyboard interactions and narrow-device checks; branding updates to generated marketing material after the chosen direction; icon safe-zone and manifest validation; customer and marketer regression tests; removal or conversion of the review-only switch into the chosen final identity. Do not merge this branch just to preview a design.
