# PRD Quality Review — URL Shortener System

## Overall verdict

**Fair; revise before approval for UX, architecture, or story generation.** The PRD has a specific vision, disciplined MVP boundary, coherent feature grouping, stable IDs, and unusually clear privacy intent for a portfolio project. It is not yet decision-ready for real marketing use: the flagship attribution journey cannot work as written, the success metrics mostly prove feature presence rather than user value, and the analytics, performance, security, and namespace contracts leave downstream teams to make product decisions.

No finding is critical at the stated stakes because the product thesis and recoverable MVP boundary are intact. The high findings are phase blockers: resolve them before treating the draft as a build contract.

## Decision-readiness — thin

The document makes real choices rather than presenting a neutral catalog: root-level public paths, global custom aliases, request-refresh analytics, aggregate-first collection, 30-day raw-log retention, Google OAuth, and explicit non-goals. The memlog confirms the priority on system-design learning and records approval for rate limiting, 30-day retention, alias syntax, deleted-link `404`, and UTM breakdowns.

The remaining decisions are not all closed despite §10 saying no blocking questions remain. In particular, a root-level `/{Code}` or `/{Alias}` namespace makes collision policy part of the product contract, not merely an architecture detail. Several inline assumptions also remain alternatives rather than decisions.

### Findings

- **high** Root-path namespace policy is incomplete (§3 “Reserved Path”; FR-5; FR-10) — Aliases are globally unique and occupy the same root namespace as application routes and generated codes, but the PRD gives only three examples of reserved paths. It does not decide whether aliases may collide with generated codes, future routes, case-normalized forms, or tombstoned aliases. The memlog confirms syntax but not global uniqueness or namespace precedence. *Fix:* Define one canonical namespace and normalization rule, generated-code/alias collision handling, an authoritative reserved-path policy, and whether deleted aliases can be reused.
- **medium** “No blocking questions” is not supported by the assumptions (§10–§11) — FR-14 still permits either zero-filled or omitted dates, NFR-2 has no performance acceptance method, and several UX behaviors remain assumed. These choices affect charts, stories, and tests. *Fix:* Resolve the phase-blocking alternatives; for each remaining assumption, record owner, chosen default, and revisit condition rather than only indexing it.

## Substance over theater — adequate

The vision is product-specific, the two named protagonists drive create/edit requirements, and the non-goals prevent template-driven expansion. Privacy constraints, estimated location, unknown attribution, redirect independence from enrichment, and counter-metrics are earned by this product rather than generic furniture.

The weak area is the quality layer. “Latency thấp,” “đủ nhanh,” “đủ tin,” and “usefulness” sound responsible but provide no observable bar. This is NFR and success-metric theater at the points where real-use credibility depends on evidence.

### Findings

- **high** Product-specific quality promises have no acceptance bar (§1; NFR-1–NFR-12; SM-3) — The vision promises analytics “đủ tin” and real marketing use, but redirect latency, dashboard latency, analytics freshness, data completeness, session security, and credential protection have no bounds or verification method. NFR-2 explicitly defers a target without replacing it with a manual or benchmark gate. OAuth `state` alone does not define the security outcome for email/password accounts and authenticated mutations. *Fix:* Add stakes-calibrated gates: a small declared load/latency envelope, a maximum freshness lag or explicit synchronous rule, a reconciliation tolerance for test clicks, and security outcomes for password storage, session cookies/lifetime, login throttling, CSRF on state-changing actions, and ownership enforcement.
- **medium** The UTM casing warning is activity without a decided outcome (FR-12) — “Cảnh báo” does not say whether users may continue, whether values are normalized, or how spaces are encoded; the addendum only establishes that UTM values are case-sensitive. *Fix:* Specify warning-only versus blocking behavior and preserve user-entered casing unless normalization is an explicit product decision.

## Strategic coherence — thin

The thesis is recognizable: a deliberately small campaign-link workflow used to learn redirect, event capture, aggregation, ownership, and privacy-aware analytics while remaining credible to marketers. The sequence and exclusions serve that thesis.

The core journey and metrics do not fully validate it. UJ-1 describes a single tagged link shared through two channels, then claims the marketer can compare those channels. The success metrics primarily confirm that screens and fields exist; they do not prove a marketer can make the decision described in the journey or trust the numbers.

### Findings

- **high** The flagship channel-attribution journey cannot produce its claimed conclusion (§2.3 UJ-1; FR-12; FR-15; SM-4) — One short link has one destination and one fixed set of `utm_source`, `utm_medium`, and `utm_campaign`, yet Linh shares that same link via email and ads and later concludes ads outperformed email. A fixed `utm_source`/`utm_medium` cannot represent both shares, and referrer is unreliable for email. *Fix:* Make UJ-1 create distinct channel links with distinct UTM values, or add an explicit per-channel variant capability. Align FR-12, FR-15, and SM-4 with the selected model.
- **high** Success metrics validate implementation, not product success (§8 SM-1–SM-7) — “Can create,” “fields display,” manual/E2E redirect correctness, and portfolio clarity are acceptance checks. None validates task comprehension, time-to-create, channel-comparison accuracy, analytics trust, or repeated marketing usefulness. SM-7 is subjective and says it validates the entire MVP without a rubric. *Fix:* Keep these as release acceptance criteria, then add a small outcome layer tied to the thesis, such as an unassisted campaign-link task, correct identification of the leading channel from seeded data, a declared click-count reconciliation threshold, and a scored system-design demo checklist.

## Done-ness clarity — thin

Every FR has consequences, and several are directly testable: invalid schemes are rejected, ownership is enforced, duplicate aliases fail, deleted paths return `404`, creation throttling returns `429`, and raw IP is hidden. This is a strong base for story extraction.

The central analytics contract is still ambiguous. “Total click” and “Click Event” do not establish what is counted, when counts become visible, or how grouping and filters behave. Authentication, URL composition, deletion, and throttling also lack a few boundary outcomes needed for deterministic acceptance tests.

### Findings

- **high** The analytics truth contract is undefined (§3 “Click Event”; FR-11; FR-13–FR-16; NFR-1; SM-3–SM-4) — The PRD does not decide whether totals count requests or deduplicated visits, whether bots/previews count, how retries and duplicate event delivery are handled, the reporting timezone, default date range, filter intersection semantics, or maximum processing lag. FR-14 explicitly allows two different zero-day behaviors. A system can satisfy the prose while showing materially different numbers. *Fix:* Define MVP counting semantics, bot policy, idempotency expectation, reporting timezone/date range, filter semantics, zero-bucket behavior, unknown buckets, and freshness/completeness acceptance.
- **medium** Authentication completion criteria stop before account lifecycle is usable (FR-1–FR-3) — Sign-up, sign-in, and ownership are present, but logout, session expiry, duplicate-email behavior, OAuth/email identity collision, and password recovery or its explicit deferral are absent. *Fix:* Specify the minimum account lifecycle and error outcomes; explicitly list password reset/account linking as non-goals if deferred.
- **medium** Destination URL and UTM composition has no deterministic merge contract (FR-4; FR-7; FR-12) — Existing query strings, fragments, pre-existing `utm_*` keys, empty fields, Unicode, and percent-encoding are unspecified. “UTM values are retained” does not determine the final URL. *Fix:* Define merge/replace behavior and include acceptance examples for an existing query, fragment, duplicate UTM key, and encoded value.
- **medium** Deletion semantics conflict with retained analytics (§4.2 FR-8; NFR-8; NFR-12) — FR-8 says delete, NFR-12 says “xóa hoặc disable,” and the PRD does not state whether historical aggregates/events survive deletion, whether the path is tombstoned, or whether deletion is reversible. *Fix:* Select hard delete, soft delete, or disable for MVP and define redirect, dashboard history, raw-event/aggregate retention, and alias-reuse behavior.
- **medium** Rate-limit recovery behavior is underdefined (FR-9; SM-5) — Architecture may choose the threshold, but the product contract does not require a retry time/header, define the counting window, or distinguish account creation abuse from authenticated link creation. “Có thể thử lại sau” is not testable. *Fix:* Require a discoverable retry time and a deterministic configured policy exposed to tests; leave the numeric default in configuration.

## Scope honesty — adequate

The PRD is candid about non-users, non-goals, MVP exclusions, assumptions, privacy limits, estimated location, and absent realtime behavior. The memlog shows that several constraints were explicitly accepted rather than silently invented. The addendum appropriately keeps research and architecture guidance outside the product requirements.

Scope honesty is weakened by failing to reconcile confirmed decisions back into the PRD’s assumption status and by allowing “delete or disable” after selecting delete behavior. These are fixable control issues, not evidence of uncontrolled scope.

### Findings

- **low** Confirmed decisions and assumptions are not cleanly separated (§11; `.memlog.md`) — Alias syntax, 30-day retention, deletion `404`, request refresh, and UTM breakdowns are logged decisions, while related PRD text still mixes assumption tags and undecided details. A future updater cannot tell which clauses may be revisited without comparing files manually. *Fix:* Remove assumption tags only for the exact confirmed clauses; retain and fully word the unconfirmed parts.

## Downstream usability — thin

The PRD is explicitly chain-top and therefore needs strong extraction quality. FR-1 through FR-16, UJ-1 through UJ-2, SM-1 through SM-7, and SM-C1 through SM-C3 are contiguous and unique. Feature grouping, glossary terms, per-FR consequences, and stable sectioning support UX, architecture, and story work.

However, the unresolved product semantics above would force each downstream workflow to invent a different answer. The accompanying reconciliation report also describes an older PRD state, creating a second source of truth.

### Findings

- **medium** The reconciliation artifact is stale and contradicts the current PRD (`reconcile-product-brief.md` G-01, G-03, G-04, G-07; current FR-5, FR-9, FR-15, SM-4; `.memlog.md`) — It still says UTM analytics are absent and rate limiting, alias rules, retention, deleted-link behavior, and request refresh are unconfirmed, although the PRD and memlog now include approvals for most of them. Downstream readers may reopen already-resolved decisions or miss the remaining narrower gaps. *Fix:* Regenerate the reconciliation report from the current PRD and memlog, marking exact clauses resolved and preserving only unresolved points such as global uniqueness and analytics usability.
- **low** Journey-to-requirement traceability is partial (§2.3; §4; §8) — UJ-1/UJ-2 are cited by link management and UTM sections, but authentication and analytics requirements used by UJ-1 do not consistently state that relationship; deletion has no journey or scenario. SM-7’s “validates toàn bộ MVP” is not usable traceability. *Fix:* Add concise `Realizes UJ-*` references to the relevant feature groups and replace SM-7’s blanket claim with explicit covered IDs or a separate demo rubric.

## Shape fit — strong

The shape fits a small web product that feeds UX, architecture, and stories. Two inline personas are enough: they carry concrete campaign and correction contexts without a standalone persona section. Capability groups with nested FRs suit the system-design learning goal, while journeys preserve the marketing decision loop. The PRD avoids enterprise ceremony, an unnecessary traceability matrix, and technical implementation detail; the addendum holds research and architecture guidance appropriately.

No additional persona, market-sizing, monetization, or platform section is warranted for the stated portfolio-plus-real-use stakes.

## Mechanical notes

- **ID continuity:** UJ-1–UJ-2 and FR-1–FR-16 are contiguous and unique. Primary/secondary metrics SM-1–SM-7 and counter-metrics SM-C1–SM-C3 are contiguous within their own namespaces. All explicit FR/UJ/SM references resolve.
- **Cross-references:** No broken section or ID reference found. Traceability is valid but incomplete as noted above.
- **Assumptions roundtrip:** Eight inline assumption sites have eight semantic counterparts in §11. The roundtrip is lossy because UJ-2, FR-12, FR-14, and FR-16 use bare `[ASSUMPTION]` tags while the index supplies the wording; NFR-2’s index entry records only the missing target, not the permitted implementation alternatives.
- **low** Glossary and naming drift — The glossary defines capitalized **Short Link**, **Destination URL**, **Code**, **Alias**, and **Click Event**, while later sections use lowercase “short link,” “destination,” “short path,” “click,” and `Code`/`Alias` route placeholders interchangeably. `/{codeOrAlias}` appears in the memlog but not the glossary. *Fix:* Normalize domain terms and define “short path” if it is intentionally distinct from **Short Link**.
- **UJ protagonist naming:** Both journeys have named protagonists with context inline: Linh in UJ-1 and Minh in UJ-2.
- **Required sections:** The essential sections for these stakes are present. A separate acceptance-criteria section is optional if the consequences and success metrics are tightened as recommended.

## Finding totals

- Critical: 0
- High: 5
- Medium: 7
- Low: 3
