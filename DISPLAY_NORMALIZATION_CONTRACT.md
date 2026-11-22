# Display Normalization Contract

Imported, provider and user content is shown as text. React escapes every string it renders, so tags, scripts and entities in a value appear as characters, never as markup; no surface renders HTML from a string (nothing in `app/`, `components/` or `lib/` uses `dangerouslySetInnerHTML`; the manual and markdown are built as React elements). Long values wrap and never widen the page. The postdeploy click audit (`scripts/postdeploy-click-audit-unified.mjs`) fails on a raw payload marker (`<script`, `<div`, a replacement character, raw JSON) or horizontal overflow on any audited page.

The separate `normalizeDisplayValue` helper was removed on 22 Nov 2026: no surface imported it, so it was a second, unused boundary beside React's own.
