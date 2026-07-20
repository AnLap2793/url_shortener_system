# IA and Key-Flow Review

**Scope:** Compare final `EXPERIENCE.md` and `DESIGN.md` against final PRD. Focus: surface closure, navigation, marketer task completion, responsive behavior, and operational states.

## Critical

1. **UJ-1 campaign comparison has no executable surface.** The PRD requires Linh to compare two links and see breakdowns for both (PRD §2.3, FR-13–FR-15). `EXPERIENCE.md` defines analytics only on singular Link detail and says “campaign comparison uses Link detail,” but provides no multi-link selector, comparison route, aggregate campaign view, or way to move between the two links while preserving filters. Step 6 also says the dashboard shows data “cho hai link” without defining how. Add a concrete comparison surface or revise the PRD journey to single-link analysis; do not leave implementation to invention.

2. **Email verification is missing from the IA and flows.** FR-1 requires email verification before an email/password account becomes active. Sign in/Sign up is listed as one surface, but there is no verification-pending, resend, expired-token, or verified-success state, nor navigation to return to sign-in. A marketer cannot complete email/password onboarding from the documented experience.

## High

3. **Auth failure/loading coverage is incomplete.** OAuth cancellation/collision and session expiry are covered, but email login/signup rate limiting (NFR-6), network/server failure, submit loading, verification failure, and sign-out failure are not. Add non-enumerating errors, disabled-submit/loading behavior, retry guidance, and preserved form values where safe.

4. **Create/edit mutation failure is underspecified.** Validation and HTTP 429 are covered, but generic save failure, timeout, duplicate-submit prevention after an unknown result, and delete failure are absent. Define a recoverable error that preserves input and prevents accidental duplicate links. Delete should explicitly remove the row from Links and explain that retained aggregates are hidden, matching PRD FR-8/NFR-12.

5. **Google linking lacks an actionable Account flow.** Account mentions “Google linking status,” and UJ-3 states the safe re-authentication sequence, but no Account entry point, confirmation, success, cancellation, or failure state is defined. Add the minimum route/action sequence; otherwise this is invented behavior.

## Medium

6. **Analytics contract is too generic.** The filter bar says “dimensions,” while PRD FR-15 requires referrer, country, city, device, browser, and all three UTM dimensions, with AND semantics. Enumerate these controls, default the date range to the required last 30 days (PRD FR-14), and specify how filters apply on Link detail/comparison.

7. **List/detail navigation lacks explicit return and refresh behavior.** Row navigation is defined, but back-to-Links, post-create destination, post-edit confirmation, and post-delete return are not. Add route-preserving navigation and explicit success destinations without auto-routing.

8. **Responsive analytics/filter behavior is incomplete.** Drawer, stacked cards, and horizontal table scrolling are defined, but mobile filter overflow, chart-to-table fallback placement, refresh/status announcement, and dialog focus/scroll behavior are not. Specify these so mobile analysis does not depend on hover or hidden controls.

## Low

9. **Public 404 is only a protocol statement.** `/{Code}`/`/{Alias}` failure is documented as HTTP 404, but no user-facing 404 content or recovery link is defined. This is acceptable if intentionally server-minimal; otherwise add a branded, chrome-free 404 state.

**Unresolved questions:** Choose a multi-link comparison surface versus revising UJ-1; confirm whether email verification is product-owned or an external provider screen.

**Status:** DONE
**Summary:** Found two critical closure gaps (campaign comparison and email verification), three high operational/auth gaps, and four medium/low IA detail gaps.
**Concerns/Blockers:** UJ-1 cannot be completed without an explicit comparison decision.
