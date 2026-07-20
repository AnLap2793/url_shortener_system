# UX Rubric Review

**Artifacts reviewed:** `DESIGN.md`, `EXPERIENCE.md`, `.memlog.md`, and the URL Shortener PRD, dated 2026-07-19.

## Verdict

**Strong foundation; downstream-ready with concerns.** The documents form a coherent Calm Analytics direction and cover the principal MVP workflow, accessibility floor, responsive behavior, and failure states. The main blocker is unresolved cross-link campaign comparison, followed by incomplete auth/error surface closure and token handoff precision.

## What is working

- **Product thesis:** Calm, data-first visual choices match the PRD’s promise: create campaign links, redirect reliably, and understand attribution without realtime or decorative-dashboard claims.
- **Spine separation:** Ownership is explicit: `DESIGN.md` owns visual tokens and `EXPERIENCE.md` owns behavior. This is a useful implementation contract and avoids competing sources of truth.
- **Behavioral completeness:** Alias normalization/collision, UTM replacement and preservation, copy fallback, refresh lag, stale-data retention, 404/tombstone deletion, OAuth collision, rate limiting, and session expiry are unusually well covered.
- **Accessibility and responsive fit:** Keyboard operation, focus return, live regions, table alternatives, reduced motion, 44px targets, zoom/reflow, and mobile drawer/table behavior are concrete and product-appropriate.
- **Scope honesty:** Deferred capabilities (custom domains, workspaces, bulk creation, realtime, password reset, public API) are consistently excluded rather than implied.

## Findings

### P1 — Campaign comparison is not closed
UJ-1 creates two links and expects the marketer to identify the stronger channel. The IA exposes only a singular Link detail analytics surface, and the interaction rules scope filters to the current dashboard/detail context. There is no multi-select, comparison view, side-by-side state, or explicit “compare links” behavior. This conflicts with the PRD journey’s two-link comparison outcome and leaves the core product thesis unverifiable. Either add a comparison surface/flow or narrow UJ-1 and the PRD success criterion to single-link inspection.

### P1 — Authentication IA omits required lifecycle surfaces
The PRD requires verified email before email/password activation, but the IA has only “Sign in / Sign up.” Add pending-verification, resend, verified-success, and verification-failure states, or explicitly define them as states within that surface. Account-linking is mentioned, but the Account surface lacks the exact re-authentication and link-success/failure states needed by the OAuth collision journey.

### P2 — Public error closure is implicit
A deleted/nonexistent path returns HTTP 404, but no public 404 surface is listed. Define the browser-visible response (minimal branded 404 or plain response) while preserving the “no external redirect” rule. Also add link-search no-results and generic create/edit/network failure states; current coverage is strongest for validation and analytics failures.

### P2 — Token handoff is not fully implementation-ready
`EXPERIENCE.md` introduces the unresolved placeholder `{path.to.token}`. Replace it with exact token names or a documented token namespace. Focus-ring thickness/offset, semantic typography roles, breakpoint tokens, and chart-series contrast rules are not specified. The categorical palette includes green/orange colors near status semantics; direct labels help, but implementation should state how status meaning is kept distinct from series identity.

### P2 — Minor ambiguity
“Sticky copy/create action where useful” is subjective for implementation. Define the exact mobile surfaces and trigger behavior, or omit the behavior until validated.

## Recommended gate

Resolve both P1 findings before handing UX to epics/stories. Resolve P2 token and state details during component specification; otherwise teams will invent behavior and weaken the documented spine.

**Status:** DONE_WITH_CONCERNS
**Summary:** UX direction and behavioral spine are strong, accessible, and largely aligned with the PRD; campaign comparison and auth lifecycle are not closed.
**Concerns/Blockers:** P1 comparison flow; P1 email verification/OAuth-linking surface states; P2 public/error closure and unresolved token references.
