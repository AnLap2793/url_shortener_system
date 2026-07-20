# Adversarial Seam Review

## Code Review Summary

### Scope

- Files: `ARCHITECTURE-SPINE.md`, `C4-DIAGRAMS.md`
- Focus: compatibility of independently built frontend, API, worker, database, auth, and deployment units
- Method: edge-case scouting plus two-pass critical/informational review; the spine wins where C4 conflicts
- Source check: binding PRD consulted only to test whether the AD set fully carries its declared bindings

### Overall Assessment

Macro-boundaries are sound: PostgreSQL is redirect and queue truth, application use cases own mutations, aggregate writes are idempotent, and ownership is required inside use cases. The artifacts are not yet a sufficient build substrate for independent teams. Several cross-unit protocols remain prose concepts rather than executable contracts. Teams can follow every AD as interpreted and still produce incompatible schemas, routing, auth policy, queue transitions, analytics responses, or rollout order.

### Adversarial Construction

A plausible compliant split build exposes the seams:

1. Auth uses Better Auth opaque text user IDs and default linking settings because AD-9 gives it ownership. Data creates `short_link.owner_id uuid` because the consistency convention and C4 say UUID.
2. API stores `utm_snapshot` and `dimensions` as JSON text. Worker expects delimited text or individual columns because AD-8 names information but no storage contract. Both preserve the named fields; processing fails.
3. Worker A increments attempts on failure. Worker B increments on claim and uses no lease token. A slow stale worker can overwrite B's state after lease reassignment even though UUID idempotency prevents double aggregate increments.
4. Frontend adds `/campaign` as an SPA route after the namespace allocated it. C4 sends it to SPA; AD-2 says the existing short path wins. No shared registry or release gate rejects the combined artifact.
5. API serializes PostgreSQL `bigint` counts as strings; dashboard treats OpenAPI `int64` as JavaScript `number`. They also disagree on inclusive date ends and which layer inserts zero-count days.
6. Retention deletes a 30-day-old dead letter and cascades its processed marker although AD-7 calls exhausted rows replayable. Reintroducing that UUID can increment facts again.

These are integration failures, not style preferences.

## Pass 1 — Critical Issues (Blocking)

### 1. Route ownership has a normative conflict and no collision gate

- Evidence: `ARCHITECTURE-SPINE.md:57-61` says existing short paths beat routes added later and new routes must reserve unallocatable prefixes. `C4-DIAGRAMS.md:81-92` evaluates an SPA route before the root short-path route.
- Divergence: web can claim a root path already present in PostgreSQL. Depending on whether SPA matching or namespace lookup runs first, the same URL renders SPA or redirects.
- Impact: existing public links silently break on frontend releases.
- Required fix: define one executable arbitration algorithm and one owner for the reserved-path registry. CI/deploy must compare every exact root SPA/system route and reserved prefix against active paths and tombstones. Correct the C4 flow. Prefer all future SPA routes under a reserved prefix; do not add a second runtime registry.

### 2. Namespace storage does not enforce its lifecycle invariant

- Evidence: `ARCHITECTURE-SPINE.md:63-67` requires one namespace, atomic tombstoning, disabled links, and no reuse. `C4-DIAGRAMS.md:169-188` models independent optional `SHORT_PATH -> SHORT_LINK` and `SHORT_PATH -> TOMBSTONE` relationships, permitting both and showing no active-state constraint.
- Divergence: one data unit can retain a disabled link plus tombstone; another can move the path to a tombstone table. Redirect repositories can prioritize different relations.
- Impact: a deleted path can redirect, an active path can 404, or a path can become reusable after cascade/delete.
- Required fix: publish DDL-level invariants. Minimal design: one immutable `short_paths` row with unique canonical text and explicit lifecycle state/retired timestamp; keep the link soft-deleted for retained facts. If tombstones remain separate, define FK direction, `ON DELETE`, uniqueness, and enforced active-versus-retired exclusivity. Name the namespace constraint so API distinguishes its `23505` from unrelated unique violations.

### 3. Better Auth identity shape and schema ownership are undefined

- Evidence: `ARCHITECTURE-SPINE.md:99-103` gives Better Auth ownership of users/sessions; `ARCHITECTURE-SPINE.md:139-147` says IDs are UUID and Drizzle owns migrations; `C4-DIAGRAMS.md:171-187` makes `SHORT_LINK.owner_id` a UUID FK but does not define `USER` or auth-table migration ownership.
- Divergence: Better Auth may emit opaque text IDs while repositories require UUID. Better Auth schema generation and `packages/db` can independently alter the same auth tables.
- Impact: signup succeeds but owned-link persistence fails; deployments can reject or corrupt auth schema changes.
- Required fix: select the exact Better Auth ID strategy, actor-context type, FK target, and migration owner. Route generated auth schema through one migration pipeline. Add a contract test that creates a real Better Auth user/session and persists a link using the resolved actor ID.

### 4. Binding auth policies are not encoded in AD-9

- Evidence: `ARCHITECTURE-SPINE.md:99-103` states ownership and handler order, but not email-verification gating, anti-enumeration behavior, account-collision behavior, re-authenticated Google linking, or application CSRF enforcement. Same origin is not CSRF protection.
- Divergence: auth can allow unverified sign-in or automatic email-claim linking while application assumes verified, explicitly linked identities. Nest mutations can trust cookie sessions without applying auth-route protections to `/api/*`.
- Impact: account takeover/linking errors, unauthorized mutations, and violation of the security requirements the AD claims to bind.
- Required fix: record concrete Better Auth settings and account-link state machine. Define one CSRF mechanism for all cookie-authenticated Nest mutations, including generated-client behavior and problem responses. Test unverified login, email collision, re-auth linking, logout/session expiry, and cross-site mutations.

### 5. Abuse controls have no shared atomic architecture

- Evidence: no AD defines login or per-account link-creation rate limiting, although the spine claims to bind all requirements. Independent restartable/scalable API services are allowed at `ARCHITECTURE-SPINE.md:129-133`.
- Divergence: each replica can use an in-memory limiter; restarts reset it and replicas multiply allowance. Auth and link controllers can key email/IP/account differently.
- Impact: brute force and link-spam controls disappear under scaling; 429 behavior is nondeterministic.
- Required fix: define scope, key, window, limit, trusted client-IP source, atomic store, and `Retry-After`. Use PostgreSQL unless measured constraints justify another dependency. Ensure rejection and link creation cannot race past the account limit across replicas.

### 6. Queue leasing lacks a fenced state machine

- Evidence: `ARCHITECTURE-SPINE.md:87-91` names pending claims, lease expiry, attempts, five retries, and dead-letter, but no legal states, transition predicates, ownership token, attempt increment point, `next_attempt_at`, lease duration, or clock source. `C4-DIAGRAMS.md:129-140` does not add them.
- Divergence: workers count attempts on claim versus failure, reclaim with application clocks, or update rows after their lease expires and another worker owns them.
- Impact: premature dead-lettering, infinite retry, lost work, stale state overwrite, and freshness breaches. UUID aggregate idempotency does not fence queue state writes.
- Required fix: specify row states and conditional SQL. Claims atomically set a unique lease token/owner and DB-derived expiry; completion/reschedule/dead-letter require matching event ID, lease token, and processing state. Define attempt semantics, backoff, batch/lease bounds, and shutdown behavior.

### 7. Raw retention conflicts with dead-letter replay and idempotency retention

- Evidence: `ARCHITECTURE-SPINE.md:87-97` says exhausted events remain replayable, raw events are deleted after 30 days, and processed UUIDs guard replay. `C4-DIAGRAMS.md:189-204` puts queue payload/status on `CLICK_EVENT` but defines no deletion behavior.
- Divergence: retention can delete pending/dead-letter payloads or cascade processed UUIDs. Another implementation can retain dead letters beyond 30 days and violate raw retention.
- Impact: privacy retention or replayability is lost; restored UUIDs can double-count.
- Required fix: define eligibility and race protocol. Raw payloads, including dead letters, get a replay deadline no later than 30 days; retention skips active leases, alerts before expiry, and deletes conditionally. Keep a minimal non-raw UUID ledger for the aggregate/replay horizon without cascading FK to raw events, or prohibit replay after ledger expiry.

### 8. Cross-service schema/version rollout is unspecified

- Evidence: `ARCHITECTURE-SPINE.md:129-147` requires independent restarts, one pre-traffic migration, and expand/migrate/contract, while API and worker share tables and can deploy independently. `C4-DIAGRAMS.md:145-165` shows migration without ordering or locking.
- Divergence: new API writes a new event shape while old worker runs; new worker claims rows created under old schema; duplicate migration jobs start during deploy.
- Impact: production-only event loss, worker crashes, or table locks during traffic.
- Required fix: define N/N-1 compatibility for each shared table/event payload, migration advisory locking, rollout order, and readiness schema checks. Web bundle and generated client must ship from the same source revision as the API.

## Pass 2 — High-Priority Issues

### 9. Click-event and fact shapes are conceptual, not interoperable

- Evidence: `ARCHITECTURE-SPINE.md:81-97` names UUID, timestamp, UTM, and a nine-dimension key. `C4-DIAGRAMS.md:189-204` collapses UTM and dimensions into unspecified `text`.
- Divergence: JSON object, array, delimited string, and columns all satisfy the description. Missing versus empty values, casing, UA taxonomy, and `unknown` normalization can differ.
- Impact: parse failures, split buckets, incorrect AND filters, and irreversible migration problems.
- Required fix: add canonical DDL/data dictionary for `CLICK_EVENT`, `PROCESSED_EVENT`, and `DAILY_DIMENSION_FACT`: names, SQL types, nullability, max sizes, normalization, taxonomy, UTC conversion, composite unique/indexes. Prefer explicit filter columns over opaque blobs. Version serialized payloads.

### 10. Redirect URL and UTM capture semantics are incomplete

- Evidence: `ARCHITECTURE-SPINE.md:69-79` defines lookup/capture/redirect but not path decoding/case handling or query merging. `C4-DIAGRAMS.md:104-111` shows only a bare path and UTM snapshot.
- Divergence: APIs can treat `/Alias`, `/%61lias`, encoded slash, or trailing slash differently. One app appends inbound query to destination while another drops it. Duplicate/case-variant UTM keys can use first, last, or all values.
- Impact: redirect correctness and campaign attribution differ; crafted encodings can bypass reserved-path assumptions.
- Required fix: define raw-path parsing/rejection, canonical lowercase lookup, exact `Location` construction, inbound-query policy, and effective UTM extraction including duplicates/case. Use one URL parser and validate final stored URLs for scheme, controls, credentials policy, and max length.

### 11. Redirect versus edit/delete has no declared linearization point

- Evidence: `ARCHITECTURE-SPINE.md:69-79` performs lookup then event insert; `ARCHITECTURE-SPINE.md:117-121` makes mutations transactional but does not coordinate redirect reads.
- Divergence: redirect reads old destination, edit/delete commits, then redirect inserts event and returns stale destination. Another repository locks and returns 404/new destination.
- Impact: externally visible outcomes differ around concurrent mutation; current destination and deleted returns 404 are nondeterministic.
- Required fix: declare lookup the redirect linearization point and permit old result when overlap occurs, or serialize lookup/capture with mutations. Add concurrent delete/edit tests.

### 12. Dimension bounding and privacy transformation are unspecified

- Evidence: `ARCHITECTURE-SPINE.md:75-79` says bounded dimensions and no raw IP; `ARCHITECTURE-SPINE.md:141-146` forbids sensitive logs. No bounds/canonical form for referrer or UTM are given; C4 uses unrestricted text.
- Divergence: API can store full referrer path/query while another stores host; attacker-controlled high-cardinality dimensions enter fact keys. Geo derivation differs if proxy address is trusted incorrectly.
- Impact: PII/query secrets leak into retained facts, aggregate-cardinality denial of service, and spoofed location analytics.
- Required fix: define bounded privacy-safe referrer, cap every retained dimension/destination at validation, define UTM truncation/rejection, and document Render trusted proxy hops. Never persist client IP.

### 13. Aggregate query and API semantics cannot be inferred from OpenAPI types

- Evidence: `ARCHITECTURE-SPINE.md:93-115` assigns fact reads/generated contracts. `C4-DIAGRAMS.md:199-204` uses `bigint click_count` but defines no response representation, date boundary, zero-fill, ordering, or freshness watermark.
- Divergence: DB drivers return bigint as string while chart code expects number. API/frontend disagree on inclusive dates, empty-day filling, breakdown ordering, and last updated.
- Impact: precision loss, chart/type failures, off-by-one totals, unstable UI, fabricated freshness.
- Required fix: define DTO semantics: count as decimal string or bounded safe integer, UTC half-open date range, zero-fill owner, deterministic ordering/tie-breaks, and worker-derived `lastProcessedAt` watermark. Define and measure indexes for dashboard filters at 100k events.

### 14. Generated-contract provenance is not a build gate

- Evidence: `ARCHITECTURE-SPINE.md:111-115` requires CI generation/review but not generation order or stale-output failure.
- Divergence: frontend compiles against previous generated package while API compiles changed DTOs; both builds pass separately.
- Impact: same-release runtime shape mismatch despite generated types.
- Required fix: generate OpenAPI from compiled API, regenerate client, fail on dirty/stale output, then build SPA against that artifact. Version it if web/API deploy separately.

### 15. Global DB connection and shutdown budgets are absent

- Evidence: `ARCHITECTURE-SPINE.md:69-73` asks for bounded redirect pool; `ARCHITECTURE-SPINE.md:129-133` permits independent processes and bounded shutdown. No aggregate pool, LISTEN, lease-to-shutdown, or Render termination budgets are given.
- Divergence: each process chooses a locally bounded pool that collectively exceeds PostgreSQL capacity. Worker claims batches exceeding lease or SIGTERM grace.
- Impact: connection exhaustion, redirect latency spikes, abandoned leases, deployment queue lag.
- Required fix: set deployment-wide connection budget and derive per-instance API/worker/migration pools from maximum replicas. Reserve LISTEN/migration capacity. Bound batch processing below lease and drain grace, stop claiming on drain, and guard completion by lease token.

## Positive Observations

- PostgreSQL uniqueness and unique-violation collision handling are concurrency-safe (`ARCHITECTURE-SPINE.md:63-67`).
- Redirect truth has one source and cache introduction is benchmark-gated (`ARCHITECTURE-SPINE.md:69-73`).
- Event-insert failure is isolated from redirect availability and measured (`ARCHITECTURE-SPINE.md:75-79`).
- Aggregate mutation and idempotency are transactional (`ARCHITECTURE-SPINE.md:81-91`, `117-121`).
- Authorization is required inside use cases, including compare ownership (`ARCHITECTURE-SPINE.md:105-109`).
- Raw IP and sensitive logging restrictions are explicit (`ARCHITECTURE-SPINE.md:141-146`).

## Recommended Actions

1. Add one canonical cross-component contract: auth ID, namespace lifecycle, click/queue/fact DDL, constraints, indexes, and retention.
2. Add fenced queue transitions and resolve dead-letter versus 30-day retention.
3. Make route reservation and schema compatibility deploy gates; correct C4 route flow.
4. Bind Better Auth settings, account linking, CSRF, rate limiting, and trusted-proxy behavior.
5. Put redirect/query/UTM/date/count/freshness semantics into DTO and integration tests.
6. Define N/N-1 schema rollout and global DB connection/drain budgets.

## Behavioral Checklist

- Concurrency: namespace insert, redirect mutation overlap, queue lease reclaim, retention race, and rollout overlap reviewed.
- Error boundaries: redirect insert failure is defined; worker/parser/schema-version and auth failure mappings need contracts.
- API contracts: generated types are sound in principle; semantic and build-provenance gaps found.
- Backwards compatibility: shared DB/event version skew is blocking.
- Input validation: destination scheme exists; path encoding, URL/dimension sizes, UTM, and proxy trust remain underspecified.
- Auth/authz: use-case ownership is strong; identity type, linking, verification, CSRF, and rate limiting remain underspecified.
- Query efficiency: fact-source choice is strong; required indexes and query bounds are absent.
- Data leaks: raw IP/log bans are strong; full referrer and high-cardinality retained dimensions remain open.

## Metrics

- Type coverage: N/A — architecture artifacts only
- Test coverage: N/A — no implementation supplied
- Linting issues: N/A
- Review findings: 15 total; 8 blocking, 7 high priority

## Unresolved Questions

- Is an overlapping redirect allowed to return the pre-edit/pre-delete destination when its lookup linearized first?
- Are inbound short-URL query parameters ignored, appended, or merged into destination?
- Must Better Auth IDs be UUID, or should ownership use opaque text IDs?
- What replay horizon is allowed for dead letters under hard 30-day raw retention?
- Is referrer retained as host only, and what are maximum lengths/cardinality controls for fact dimensions?

**Status:** DONE_WITH_CONCERNS  
**Summary:** Independent units can obey stated decisions yet disagree at routing, identity, event encoding, queue state, retention, analytics DTO, and rollout seams.  
**Concerns/Blockers:** Eight contracts must be normative before parallel implementation; otherwise CI can pass while integration fails in production.
