---
title: URL Shortener System Experience
status: final
created: 2026-07-19
updated: 2026-07-19
sources:
  - ../../prds/prd-url_shortener_system-2026-07-19/prd.md
  - DESIGN.md
---

# URL Shortener System — Experience Spine

## Foundation

Responsive web app, desktop-first. Visual identity lives in `DESIGN.md`; behavioral rules reference exact tokens như `{colors.primary}`, `{colors.surface}`, `{colors.page}` và `{components.focus-ring}`. MVP uses light mode, keyboard navigation, WCAG 2.2 AA target, and request-based analytics refresh. Public visitors only use redirect/404 surfaces; authenticated marketers use dashboard surfaces.

Primary navigation: **Dashboard**, **Links**, **Account**. On mobile, navigation becomes a drawer. No command palette, drag-and-drop, infinite scroll, or realtime updates in MVP.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Sign in / Sign up | Public entry | Email/password and Google OAuth access |
| Email verification | Sign up submit | Pending, resend, expired-token and verified-success states |
| Dashboard overview | Authenticated app entry | KPI summary, recent links, trend, top breakdown |
| Links | Sidebar / Dashboard CTA | Search, list, create and manage owned links |
| Create Link | Links / primary CTA | Destination URL, alias, UTM builder, final URL preview |
| Link detail | Link table row | Link metadata, copy action, analytics dashboard |
| Compare Links | Dashboard / Links multi-select | Side-by-side comparison of 2–5 owned links using shared date range and UTM/channel breakdown |
| Edit Link | Link detail action | Change destination while preserving short path and history |
| Delete confirmation | Link detail action | Confirm deletion and explain 404/tombstone behavior |
| Account | Avatar/sidebar | Profile, logout, Google linking status |
| Public 404 | Invalid/deleted `/{Code}` or `/{Alias}` | Minimal branded 404 without external redirect |
| Public redirect | `/{Code}` or `/{Alias}` | Redirect without authentication; no app chrome |

Comparison rules: marketer selects 2–5 owned links from Links, chooses Compare, and lands on Compare Links. Shared filters use the same date range and AND semantics as Link detail. Each link keeps a stable label and color identity; charts have table fallback. On mobile, comparison cards stack vertically and the table scrolls horizontally.

Mock references: [Dashboard analytics](mockups/dashboard-analytics.html), [Create Link](mockups/create-link.html). Spines win on conflict.

Surface closure: every MVP job has a surface. Create/manage uses Create Link, Links and Edit Link; campaign comparison uses Compare Links; access lifecycle uses Sign in, Email verification và Account; public distribution uses Public redirect/Public 404.

## Voice and Tone

Microcopy is direct, calm and operational. Use marketer vocabulary from the PRD without hype.

| Situation | Use | Avoid |
|---|---|---|
| Primary action | “Create short link” | “Launch campaign magic” |
| Success | “Short link created. Copy it to share.” | “Success!!!” |
| Validation | “Use an `http` or `https` URL.” | “Invalid input.” |
| Alias collision | “That alias is unavailable. Try another.” | “Conflict error.” |
| UTM warning | “Uppercase or spaces can split campaign reports. Continue or edit the value.” | Blocking the user without explanation |
| Analytics freshness | “Updated 18 seconds ago. Data may lag by up to 60 seconds.” | Claiming realtime |
| Estimated data | “City — estimated” | Presenting geolocation as exact |
| Missing data | “Unknown” with helper text | Empty chart that looks broken |
| Deletion | “Delete this link? Its path will return 404 and cannot be reused.” | “Remove” without consequence |

## Component Patterns

Visual specs live in `DESIGN.md.Components`; tokens below reference that file.

| Component | Behavioral rules |
|---|---|
| App shell | One active navigation item; preserve current route on refresh; mobile drawer closes after navigation. |
| Link table | Short-path link in the first cell opens detail; do not turn `<tr>` into a control. Native checkbox selects 2–5 rows for Compare. Actions are native buttons/links; show short path before truncated destination; support search by alias/destination and a clear no-results state. |
| Create/edit form | Validate on blur and submit; submit remains operable so users can discover all errors. On submit, focus an error summary linked to invalid fields; set `aria-invalid` and preserve values. While request is pending, prevent duplicate submission and label progress; on timeout/unknown result, reconcile before retry to avoid duplicate links. |
| Alias field | Normalize lowercase before uniqueness check; show character rule and reserved/collision error inline; never silently replace the user’s alias. |
| UTM builder | Collapsible section; source/medium/campaign fields; non-blocking casing/space warning; replace duplicate UTM keys; preserve unrelated query and fragment. |
| Copy action | Copy full short URL; announce success through live region and toast; provide visible fallback when clipboard permission fails. |
| Analytics filter bar | Date presets Today/7/30/90 days và custom range first; dimensions: referrer, country, city, device, browser, `utm_source`, `utm_medium`, `utm_campaign`. Filters scope all cards and combine with AND; refresh preserves context. On mobile, controls wrap into a labeled Filter drawer with active-count badge. |
| Metric card | Label + value + optional trend; no color-only delta; use `{colors.chart-sequential-400}` only for data marks, not text. |
| Chart card | One chart job per card; line for daily trend; horizontal bars/table for breakdown; tooltip on hover and focus; direct labels/table fallback. |
| Delete dialog | Destructive action separated from cancel; state 404/tombstone consequence. On success, remove row and return to Links with confirmation that retained aggregates are hidden. On failure, keep dialog/input context and provide retry. |
| Toast/banner | Non-blocking for success/freshness; blocking validation stays inline; never rely on toast alone for critical errors. |

## State Patterns

| State | Treatment |
|---|---|
| Initial load | Skeletons match KPI/chart/table geometry; no layout jump. |
| Empty links | “No short links yet.” Primary action: “Create short link”. |
| Empty analytics | “No clicks in this range.” Keep filters and explain date range. |
| Loading refresh | Keep previous data at reduced opacity; show spinner on refresh button; do not blank charts. |
| Refresh success | Update `Last updated`; announce count/freshness in live region. |
| Refresh failure | Keep previous data; show “Couldn’t refresh. Try again.” with retry. |
| Analytics delay | Show last updated and up-to-60-second lag notice. |
| Unknown dimension | Render `Unknown` as a valid category with explanation. |
| Invalid URL | Inline error; submit remains operable so submit validation can reveal all errors; request is blocked until corrected; preserve field value. |
| Alias collision/reserved/tombstone | Inline error with rule; no partial creation. |
| Rate limited | HTTP 429 maps to “Too many links created. Try again later.”; preserve form and expose retry time when available. |
| Email verification pending | Explain inbox action, expose resend with cooldown, and provide “Back to sign in”. |
| Verification expired/failed | Explain token is invalid/expired; offer resend; preserve email without exposing account existence publicly. |
| Verification success | Confirm activation and offer sign in; do not auto-authenticate unless provider flow guarantees it safely. |
| Auth submitting/network failure | Label loading, prevent duplicate submit, preserve safe values, show non-enumerating retry error. Sign-out failure leaves current authenticated state explicit. |
| OAuth canceled/failed | Return to sign-in with non-enumerating error; preserve intended destination. |
| Account collision | Explain that Google is not linked; direct marketer to email/password sign-in, then Account → “Link Google”. Re-authenticate, confirm requested identity, then show success/cancel/failure inline. |
| Session expired | Warn before destructive loss when possible; preserve intended route; request sign-in; restore unsaved form only from safe local state. |
| Mutation timeout/failure | Preserve form, do not auto-create again after unknown result, reconcile server state, then offer retry. |
| Deleted/nonexistent public path | HTTP 404; minimal chrome-free page says “Link not found” and provides no external redirect. |

## Interaction Primitives

- `Tab` follows reading order; `Shift+Tab` reverses.
- `Enter` submits focused form or activates a focused row action; `Escape` closes dialog/drawer/popover.
- Focus ring uses `{colors.primary}` and remains visible against `{colors.page}` and `{colors.surface}`.
- Tooltips are enhancement only: every value is available through direct label or table fallback; keyboard focus receives the same details as hover.
- Charts are non-interactive summaries for keyboard users; the adjacent data table is the primary accessible path. Pointer hover/focus on chart container may expose tooltip, but no essential information is tooltip-only.
- Tables expose the same values as charts with caption, column headers and `scope`; interactive controls meet 44×44px target.
- Copy actions use `aria-live`; validation is associated with the relevant field via `aria-describedby`.
- Avoid hover-only actions on mobile; actions remain visible or available in a labeled menu.
- No automatic route changes after create; show success state and explicit “View analytics”.

## Accessibility Floor

- Target WCAG 2.2 AA; final conformance requires implementation testing, not this spine alone.
- Full keyboard operation for auth, forms, tables, filters, dialogs, chart data/table view and copy actions. Use native links/buttons; never make `<tr>` itself a control.
- Visible `{components.focus-ring}`; no color-only status or chart encoding.
- Semantic headings, landmarks, skip link, page title, route-change announcement, labels and error associations.
- Minimum 44×44px touch target for buttons, menu items, copy and auth controls.
- Chart has text/table alternative with caption, headers and programmatic series association; series identity is not color alone.
- `aria-live="polite"` announces create/copy/refresh; `role="alert"` is reserved for blocking errors; avoid duplicate announcements.
- Auth fields support `autocomplete`, paste and password managers; no cognitive/transcription requirement; password reveal has an accessible name and state.
- Overlays/drawers/popovers set initial focus, trap focus where modal, mark background inert, close with Escape and return focus to trigger.
- Error summary receives focus and links to fields; fields use `aria-invalid` and `aria-describedby`; preserve values after errors.
- Respect `prefers-reduced-motion`; no required animation for comprehension.
- Reflow works at 320 CSS px and 400% zoom without two-dimensional scrolling, except data tables which may scroll horizontally in a labeled region. Validate 200% text spacing separately; overlays/sticky headers must not obscure focused items.

## Responsive & Platform

| Breakpoint | Behavior |
|---|---|
| ≥1024px | Persistent sidebar, 12-column dashboard, table actions visible. |
| 768–1023px | Collapsed sidebar, 8-column layout, charts reduce width. |
| <768px | Drawer navigation, stacked KPI cards, single-column charts, horizontally scrollable link/comparison tables. Create action stays in top bar; Copy action stays in Link detail header. No generic sticky action. |

Desktop is primary for campaign setup and analysis. Mobile supports viewing analytics, copying links, simple edit and delete; no separate native app in MVP.

## Key Flows

### UJ-1 — Linh compares Summer Sale channels

1. Linh signs in with Google and lands on Dashboard.
2. Linh selects Create short link, enters destination, chooses `summer-sale-email`, adds `utm_medium=email`, previews and creates.
3. Linh creates a second link with `summer-sale-ads` and `utm_medium=paid-social`.
4. Success state offers Copy link and View analytics; each link is shared through its matching channel.
5. The next day, Linh opens Links, selects both channel links and chooses Compare.
6. Compare Links opens with last 30 days shared across both links; Linh refreshes without losing selection or filters.
7. **Climax:** comparison shows per-link KPI, daily trend, UTM medium breakdown, referrer, estimated location, device and browser; `Last updated` explains up-to-60-second lag.
8. Linh identifies the stronger channel and adjusts budget/content.

Failure: alias collision keeps form values and gives inline replacement guidance. Refresh failure preserves prior data and offers retry.

### UJ-2 — Minh corrects a destination

1. Minh opens Links and searches the alias.
2. Minh opens Link detail and chooses Edit.
3. Minh changes Destination URL; validation rejects non-HTTP(S) and preserves input.
4. Minh saves; the short path remains unchanged.
5. **Climax:** visiting the existing short path reaches the new destination, while historical click UTM snapshots remain unchanged.
6. Minh can later delete; confirmation states 404 and permanent tombstone.

### UJ-3 — Marketer handles account collision

1. A marketer selects Continue with Google.
2. The verified Google email matches an existing email/password account.
3. **Climax:** the system does not create a duplicate account or silently merge; it explains the next safe step.
4. Marketer signs in with email/password and links Google only after verified-email re-authentication.

## Inspiration & Anti-patterns

- Inspiration: restrained analytics tools with KPI-first hierarchy, table-backed charts and explicit data freshness.
- Avoid: decorative dashboards, rainbow charts, realtime claims, giant unexplained numbers, modal-heavy creation, hover-only mobile actions, and exact-looking city maps.
- Spine wins on conflict: `DESIGN.md` owns visual tokens; `EXPERIENCE.md` owns behavior; mocks or imports never override either.
