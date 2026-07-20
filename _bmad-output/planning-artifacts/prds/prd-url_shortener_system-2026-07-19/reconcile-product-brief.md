---
title: Product Brief to PRD Reconciliation: URL Shortener System
status: complete
created: 2026-07-19
updated: 2026-07-19
---

# Product Brief to PRD Reconciliation

## Purpose and method

This review compares the source product brief and its addendum with the drafted PRD and PRD addendum. It identifies material omissions, conflicts, and unconfirmed product decisions. The PRD was not edited.

Severity meanings:

- **Blocking:** Resolve before PRD approval or implementation planning because the issue changes the product promise, user-visible behavior, or MVP acceptance.
- **Non-blocking:** Does not invalidate the current MVP direction, but should be clarified, traced, or recorded before implementation to prevent inconsistent behavior.

## Overall assessment

The draft PRD carries forward the main MVP scope and the final addendum decisions: email/password plus Google OAuth, custom aliases, UTM builder, country and city analytics, aggregate-first privacy, short-lived raw logs, and no custom domain. The dependency order also matches the brief.

Four issues need product-level resolution before the PRD is considered complete: campaign attribution is not explicitly represented in analytics, the brief's usability/trust expectations lack acceptance criteria, alias rules were narrowed without a source decision, and the retention policy was made exact without a stated rationale. Three additional non-blocking scope/behavior decisions should be traced to avoid architecture and UX ambiguity.

## Gaps and conflicts

### G-01 — UTM campaign attribution is built and preserved but not reported

- **Severity:** Blocking
- **Type:** Missing user intent / functional scope
- **Source evidence:**
  - `brief.md` §Problem, lines 17-24: marketers need to know where clicks came from and compare channels.
  - `brief.md` §Solution, lines 30-40: campaign UTM parameters are part of the workflow and the dashboard is expected to show useful campaign performance.
  - `brief.md` §Campaign attribution, lines 131-139: UTM builder must create consistent campaign links and analytics must answer which link/channel performs.
  - `brief.md` §Difference, lines 112-116: the product's value is marketing-focused attribution, not shortening alone.
  - `addendum.md` lines 10-14: the final decision explicitly puts the UTM builder in MVP.
- **PRD location:** `prd.md` §4.4 FR-12, lines 186-198, specifies only building, previewing, and retaining `utm_source`, `utm_medium`, and `utm_campaign`. `prd.md` §4.5 FR-15, lines 220-227, lists analytics breakdowns but omits UTM source/medium/campaign. `prd.md` §8 SM-3, lines 304-312, likewise omits UTM dimensions.
- **Gap/conflict:** The PRD guarantees UTM creation and redirect preservation, but does not say that analytics expose UTM attribution. Referrer alone may not reliably distinguish email, ads, and social traffic, especially when referrers are absent.
- **Impact:** The documented workflow cannot consistently answer the core marketing question “which channel/campaign worked?” The PRD's UTM feature can become a tagging-only feature with no corresponding reporting value.
- **Required resolution:** Decide whether MVP analytics must break down or filter by `utm_source`, `utm_medium`, and `utm_campaign` (at minimum for links created by the system), or explicitly state that UTM is only preserved for downstream analytics and is not reported in this dashboard. Update the relevant FR and success metric after the decision.

### G-02 — Usability, speed, readability, and trust expectations are not acceptance criteria

- **Severity:** Blocking
- **Type:** Missing qualitative expectation / success definition
- **Source evidence:**
  - `brief.md` lines 11-13: MVP must be real enough for marketing work, not only a technical demo.
  - `brief.md` §Primary users, lines 42-46: marketers need fast operations, readable links, an understandable dashboard, and sufficiently trustworthy numbers for channel comparison.
  - `brief.md` §Success criteria, lines 118-145: analytics must be visible and useful while respecting privacy.
  - `brief.md` §MVP complexity watchlist, lines 95-100: the dashboard must prioritize core marketing questions and avoid secondary charts.
- **PRD location:** `prd.md` §1, lines 18-24, repeats the general intent but does not define measurable or testable usability expectations. `prd.md` §5 NFR-1/NFR-2, lines 237-243, says latency should be low and the dashboard sufficiently fast, but provides no target or acceptance method. `prd.md` §8, lines 304-323, has functional metrics but no metric for operation speed, dashboard comprehension, link readability, or data trust.
- **Gap/conflict:** The PRD captures what data exists, but not the qualitative bar that makes the product usable by a marketing team. “Đủ nhanh” and “đủ tin” remain subjective.
- **Impact:** UX, architecture, and testing can all satisfy the PRD while delivering a slow, confusing dashboard or unexplained analytics that fails the stated product purpose.
- **Required resolution:** Add lightweight acceptance criteria rather than enterprise-grade targets: the primary create/manage/view workflow must be usable without technical knowledge; aliases must be readable; dashboard must foreground the core dimensions; analytics must disclose estimated/missing attribution and processing freshness. If quantitative latency targets are intentionally deferred, state the deferral and define the manual/E2E usability check.

### G-03 — Alias syntax and global uniqueness are unconfirmed product decisions

- **Severity:** Blocking (product decision before implementation)
- **Type:** Scope narrowing / undocumented assumption
- **Source evidence:**
  - `brief.md` §MVP scope, lines 48-59: custom aliases require duplicate, reserved-word, and validation handling, but no exact character set, length, or case policy is specified.
  - `brief.md` §Risks, lines 147-154: aliases need reserved words and validation to avoid errors or abuse; it does not prescribe a format.
  - `brief.md` lines 42-44: links should be easy to read and quick to operate.
- **PRD location:** `prd.md` §4.2 FR-5, lines 118-127, makes aliases globally unique and restricts them to 3–64 lowercase ASCII letters, digits, and hyphens, with no leading/trailing hyphen. `prd.md` §11, lines 339-349, labels global uniqueness as an assumption.
- **Gap/conflict:** The PRD turns an intentionally open validation requirement into a strict user-facing syntax and global uniqueness policy without a source decision. This may reject readable aliases that the product brief did not exclude and determines whether different marketers can choose the same campaign slug.
- **Impact:** The restriction affects link creation, migration of existing campaign naming conventions, and collision behavior across accounts. It cannot be safely treated as an implementation detail.
- **Required resolution:** Confirm the accepted alias character/case/length rules, normalization behavior, and whether uniqueness is global or account-scoped. Keep the exact reserved-path policy explicit. Remove the assumption label only after product confirmation.

### G-04 — Raw-log retention changed from a flexible privacy principle to an exact 30-day rule

- **Severity:** Blocking (privacy/product policy decision)
- **Type:** Untraced policy narrowing
- **Source evidence:**
  - `brief.md` §MVP scope, lines 61-70: analytics are aggregate-first and raw click logs have short retention or are aggregated early.
  - `brief.md` §Handoff decisions, lines 85-91: privacy preference is short retention or early aggregation, not a fixed duration.
  - `brief.md` §Privacy and retention success criteria, lines 141-145: aggregate data is preferred and raw logs are short-lived or aggregated early.
  - `addendum.md` lines 2-8 and 10-14: privacy sensitivity and aggregate-first behavior are reaffirmed; no exact number is selected.
- **PRD location:** `prd.md` §5 NFR-7/NFR-10, lines 251-257, and especially NFR-8, lines 253-255, require raw click logs to be kept **at most 30 days**. `prd.md` §8 SM-C1, lines 319-323, constrains raw-data use but does not explain the 30-day choice.
- **Gap/conflict:** Thirty days may be a reasonable implementation choice, but it is more specific than the source and is presented as a locked product requirement without rationale, legal basis, or retention-vs-aggregation decision.
- **Impact:** Retention affects privacy exposure, storage, analytics backfill, deletion behavior, and compliance expectations. Architecture may optimize for a policy the product owner did not approve.
- **Required resolution:** Confirm the retention duration and whether raw records are deleted, irreversibly aggregated, or both. If 30 days is an intentional MVP default, label it as an approved policy assumption and specify that aggregate data survives raw-log deletion.

### G-05 — Analytics freshness and click completeness are underspecified

- **Severity:** Non-blocking
- **Type:** Missing behavior contract
- **Source evidence:**
  - `brief.md` §Solution, lines 30-40: every click is tracked and marketers return to the dashboard to assess performance.
  - `brief.md` §Analytics visibility, lines 136-139: each click should be recorded and appear in analytics.
  - `brief.md` §Risks, lines 147-152: enrichment dimensions can be missing or inaccurate, but the core click outcome remains expected.
  - PRD `addendum.md` lines 10-14: redirect should remain independent from analytics enrichment.
- **PRD location:** `prd.md` FR-11, lines 176-184, says a click event is captured and missing enrichment must not fail redirect. `prd.md` FR-13, lines 204-210, qualifies totals with “after the event is processed.” `prd.md` NFR-1 and NFR-11, lines 239-243 and 260-261, defer processing behavior to architecture.
- **Gap/conflict:** The PRD does not define acceptable delay, eventual completeness, duplicate handling, or what the user sees when an event is still processing. “Recorded” in the brief can be read as immediate, while the PRD allows asynchronous processing.
- **Impact:** Tests and UX may disagree about whether a click must appear after redirect, and marketers may interpret temporary lag as lost data.
- **Required resolution:** Add a simple freshness contract (for example, dashboard reflects processed events after refresh and may lag by a documented interval) and define that click capture is best-effort for enrichment but not silently dropped at the core event level. Exact infrastructure remains an architecture concern.

### G-06 — “Compare channels” is implied but no comparison interaction is specified

- **Severity:** Non-blocking
- **Type:** Missing user journey detail
- **Source evidence:**
  - `brief.md` lines 17-24: the team needs to know which link gets the most clicks and where clicks originate.
  - `brief.md` lines 42-44: marketers need data trustworthy enough to compare channel performance.
  - `brief.md` lines 131-139: success includes identifying effective links and click origin.
- **PRD location:** `prd.md` UJ-1, lines 44-50, describes seeing one link's dashboard and inferring ads versus email. `prd.md` FR-6, lines 129-135, shows total clicks in a link list. `prd.md` FR-15, lines 220-227, provides per-link breakdowns but no sorting, filtering, side-by-side comparison, or cross-link aggregation requirement.
- **Gap/conflict:** The PRD supports inspecting individual links and seeing referrer breakdowns, but does not guarantee a direct way to identify the best link or compare channels across links.
- **Impact:** The stated marketing decision loop may require manual navigation and spreadsheet work, reducing the product's differentiating value without technically violating the listed FRs.
- **Required resolution:** Clarify the minimum MVP interaction: link-list sorting by total clicks, per-link channel breakdown, cross-link comparison, or explicitly defer comparison and narrow the success language.

### G-07 — Additional scope decisions are present in the PRD but not traceable to the brief

- **Severity:** Non-blocking
- **Type:** Scope expansion/reduction requiring confirmation
- **Source evidence:**
  - `brief.md` §MVP scope/out-of-scope, lines 48-83, lists the agreed feature boundaries but does not mention account-based rate limiting, real-time behavior, or UTM templates.
  - `brief.md` §Risks, lines 147-154, mentions alias abuse risk but does not mandate a link-creation rate limit or a threshold.
- **PRD location:** `prd.md` FR-9, lines 154-161, makes per-account rate limiting an MVP feature. `prd.md` §7.2, lines 296-302, adds UTM templates and deep abuse detection as explicit out-of-scope items. `prd.md` §2.1/§4.5/§6, lines 36-40, 200-235, and 263-275, explicitly excludes realtime analytics and requires request refresh.
- **Gap/conflict:** These additions are plausible interpretations, not direct conflicts, but they are not all decisions handed over by the source. In particular, the brief asks for “analytics thực tế” but never explicitly says realtime is out of scope; the PRD narrows that expectation.
- **Impact:** Untraced additions can inflate MVP work, while the realtime exclusion can surprise users if “real analytics” means near-current data to them.
- **Required resolution:** Record the rationale and approval for rate limiting and request-refresh analytics. Keep UTM templates/deep abuse detection as non-goals only if confirmed. Define “real” as reliable processed analytics rather than realtime, if that is the intended interpretation.

## Items reconciled without a gap

- Email/password and OAuth are both in MVP in the brief (`brief.md` lines 30-38, 85-89) and in PRD FR-1/FR-2. Selecting Google as the first provider is consistent with the brief watchlist (`brief.md` lines 93-100) and PRD addendum (`addendum.md` lines 10-14).
- Country and city analytics are both present in the brief decision (`brief.md` lines 85-91; brief `addendum.md` lines 10-14) and PRD FR-15/NFR-10, including estimated-accuracy language.
- Custom domain, workspace/roles, QR code, bulk creation, public API, A/B routing, password protection, expiration, integrations, and billing are excluded consistently (`brief.md` lines 72-83; `prd.md` §6 and §7.2).
- Aggregate-first analytics, no cross-site profiling, no raw IP in the dashboard, and short-lived raw logs are represented in PRD NFR-7 through NFR-10, subject to the exact-retention decision in G-04.
- The dependency sequence is consistent between `brief.md` lines 102-109 and `prd.md` §9, lines 325-333.

## Recommended disposition before approval

1. Resolve G-01 first because it determines whether UTM builder delivers campaign attribution or only URL decoration.
2. Resolve G-02 and G-06 together by defining the minimum dashboard decision experience and a small set of usability/freshness checks.
3. Resolve G-03 and G-04 as explicit product/privacy decisions before data model and validation implementation.
4. Record the rationale for G-05 and G-07 in the PRD so architecture does not infer stronger or weaker guarantees than intended.

**Conclusion:** The PRD is directionally aligned with the brief, but it is not fully reconciled until the four blocking decisions are closed. No PRD content was modified by this review.
