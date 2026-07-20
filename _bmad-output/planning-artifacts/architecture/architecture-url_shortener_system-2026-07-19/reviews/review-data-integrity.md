# Data Integrity and Privacy Architecture Review

## Scope

Reviewed `ARCHITECTURE-SPINE.md`, `C4-DIAGRAMS.md`, and `prd.md`. Focus: namespace/tombstones, click durability, worker replay, leases/dead letters, dimensional facts, UTM snapshots, retention, transactions, IP privacy, queries, and indexes. Two passes: blocking correctness/privacy, then implementation/operational gaps.

## Overall assessment

Strong primitives: one PostgreSQL truth, unique event IDs, transactional aggregation, `SKIP LOCKED`, polling beside `NOTIFY`, UTC facts, no redirect cache, and owner-scoped analytics. Several guarantees remain contradictory or unenforceable. Main blockers: “durable before redirect” versus redirect on insert failure; indefinite replayable dead letters versus 30-day raw retention; never-reused paths without immutable database state; and leases without fencing. Schema, canonicalization, privacy boundary, and index contracts need completion before story/schema extraction.

# Pass 1 — Blocking findings

## B1. “Durable before redirect” contradicts redirect-on-insert-failure

**Severity:** Critical  
**Evidence:** `ARCHITECTURE-SPINE.md:74-79`; `C4-DIAGRAMS.md:108-119`; `prd.md:185-195,252-253,342-343`.

AD-5 says a counted click is durable before response, then says event-insert failure still redirects. FR-11 says each valid redirect creates an event. SM-8 demands 100% reconciliation. A volatile metric cannot reconstruct the event or dimensions.

**Required invariant:** choose one contract.

1. **Strict capture:** redirect only after event commit; database failure returns bounded `503` and no external redirect.
2. **Redirect availability:** active links redirect despite persistence failure; analytics are explicitly best-effort during DB faults. SM-8 excludes failed inserts and separately requires zero insert failures during acceptance.

Do not claim both. Rename AD-5 if availability wins.

## B2. Namespace model does not enforce permanent non-reuse or one legal state

**Severity:** Critical  
**Evidence:** `ARCHITECTURE-SPINE.md:62-67,116-121,182-190`; `C4-DIAGRAMS.md:168-204`; `prd.md:66-68,128-134,153-161`.

A unique `SHORT_PATH.short_path` serializes collisions, but C4 permits a path with both active link and tombstone, or neither. Nothing prevents deleting the namespace/tombstone and reusing its string. `UNIQUE` protects only retained rows.

**Required invariant:** prefer one permanent namespace row with immutable `normalized_path`, `state IN ('active','tombstoned')`, and `tombstoned_at`. At minimum:

- `normalized_path` is `NOT NULL UNIQUE`, canonical ASCII lowercase, never updated/deleted by application roles.
- Exactly one active link may reference an active namespace row; a tombstoned row cannot resolve.
- Create inserts namespace and link atomically. Delete locks both, tombstones namespace, disables link, and commits atomically.
- FKs use `ON DELETE RESTRICT`; account deletion cannot cascade through namespace, links, or facts accidentally.
- Generated-code collisions retry after unique violation with a bounded attempt count.

A separate tombstone table adds state ambiguity unless it carries required data.

## B3. Route flow contradicts “existing short paths win over routes added later”

**Severity:** High, release blocking  
**Evidence:** `ARCHITECTURE-SPINE.md:57-61`; `C4-DIAGRAMS.md:80-92`; `prd.md:67`.

C4 checks reserved/static/SPA routes before `GET /:shortPath`; a later root route therefore captures an existing short path. Creation-time reservation cannot protect paths allocated before route addition.

**Required invariant:** reject deployment when any new root route collides with active paths or tombstones, or permanently place future pages below `/app/*`. Route registry and alias validation must share one versioned reserved-segment source. Define case, trailing slash, percent-decoding, duplicate slash, and encoded-slash behavior.

## B4. Thirty-day retention conflicts with indefinitely replayable dead letters

**Severity:** Critical  
**Evidence:** `ARCHITECTURE-SPINE.md:87-97`; `C4-DIAGRAMS.md:128-140`; `prd.md:161,274-279`.

Dead-letter Click Events retain raw payloads. Keeping them indefinitely violates “raw logs at most 30 days”; purging them removes replayability.

**Required invariant:** dead letters are replayable only until `occurred_at + 30 days`. Alert before cutoff; purge every event payload at cutoff regardless of status. Longer forensic retention may keep only event ID, bounded error class, attempts, and timestamps, with no dimensions, referrer, UTM, IP, UA, or destination. Define `processed_event` retention too.

## B5. Lease algorithm lacks ownership fencing and mixes claim models

**Severity:** High, release blocking  
**Evidence:** `ARCHITECTURE-SPINE.md:87-91`; `C4-DIAGRAMS.md:128-139`.

`SKIP LOCKED` protects only while transaction locks are held. If claim commits before processing, worker A can resume after lease expiry while worker B owns the row. Without a token/version, stale A can overwrite state. Holding the claim transaction open makes the lease mostly redundant and harms shutdown/contention.

**Required invariant:** short claim transaction sets `status='processing'`, increments attempts, assigns random `lease_token`, sets `lease_until`, and returns a bounded batch. Later updates match `(event_id, lease_token, status='processing')`; zero affected rows means stale worker stops. Add `available_at`, use database time, increment attempts once per claim, and define retryable/permanent errors. Fifth failure rolls back aggregation, then dead-letters in a recovery transaction.

## B6. Idempotency ordering is underspecified

**Severity:** High, release blocking  
**Evidence:** `ARCHITECTURE-SPINE.md:80-85,116-121`; `C4-DIAGRAMS.md:132-139`.

“Check + UPSERT + mark processed in one transaction” is correct only if the marker has a unique key and acquisition is atomic. Otherwise concurrent workers can both increment. Dead-letter transitions must not UPSERT a fact.

**Required invariant:** `processed_event.event_id` is primary/unique. In one transaction, `INSERT ... ON CONFLICT DO NOTHING RETURNING event_id`; only a returned row increments one fact, then marks the leased event processed. Errors roll back marker, fact, and status. Duplicate marker is a no-op. Test concurrent duplicates and crashes after each statement.

# Pass 2 — Important findings

## H1. Redirect/delete/edit lack a concurrency linearization point

**Severity:** High  
**Evidence:** `ARCHITECTURE-SPINE.md:68-79,116-121`; `C4-DIAGRAMS.md:103-110`; `prd.md:144-161`.

Lookup, enrichment, insert, and response are separate. Delete can commit between lookup and response; edit can race UTM capture. Define successful lookup as the linearization point: lookups after delete commit return 404; already-observed requests may complete with the observed destination. Stronger semantics require locking through event commit and more contention.

## H2. Retention lacks cutoff, batching, and worker-race contracts

**Severity:** High  
**Evidence:** `ARCHITECTURE-SPINE.md:92-97,128-133,204-209`; `C4-DIAGRAMS.md:46-48`.

At sustained 100 requests/s, 30 days can reach 259.2 million rows, far beyond the 100,000-event benchmark. Large deletes bloat tables and can race leased workers.

**Required invariant:** database-clock cutoff `occurred_at < now() - interval '30 days'`; bounded ordered batches; consistent worker locking; dependent marker handling in the same transaction or explicit cascade; deletion-lag/oldest-row metrics. Define sustained-volume/storage thresholds that trigger partitioning before production. Benchmark retention with queue and dashboard load.

## H3. Full dimensional tuple can be near-raw and high-cardinality

**Severity:** High, privacy/performance  
**Evidence:** `ARCHITECTURE-SPINE.md:92-97,134-146`; `prd.md:233-245,274-280`.

Day/link/city/browser/device/UTM/referrer can approach one fact per click. Full referrer may contain query tokens, emails, search terms, or credentials. User-controlled UTM strings and infinite facts weaken aggregate-first privacy.

**Required invariant:** persist referrer origin/registrable domain or controlled category, stripping userinfo/path/query/fragment; bound length. Use controlled device/browser families, never raw UA. Bound UTM bytes/control characters and document no personal data. Restrict facts by owner, omit raw values from logs/metric labels, document backups, and measure fact/event cardinality.

## H4. UTM snapshot and `unknown` semantics are ambiguous

**Severity:** High  
**Evidence:** `ARCHITECTURE-SPINE.md:80-85,92-97,134-142`; `C4-DIAGRAMS.md:188-203`; `prd.md:201-210,233-245`.

Opaque `text utm_snapshot` cannot enforce the fact key. Copying link columns instead of parsing the exact selected destination breaks edit/replacement semantics. Literal user value `unknown` collides with missing.

**Required invariant:** snapshot typed decoded scalar values from the exact destination selected at redirect linearization. Define repeated keys, empty/malformed encoding, limits, Unicode normalization, and case. Use an impossible sentinel or explicit presence flags; test history across destination edits.

## H5. “No raw IP” does not cover ingress, proxies, logs, traces, or errors

**Severity:** High  
**Evidence:** `ARCHITECTURE-SPINE.md:74-79,122-127,134-146`; `C4-DIAGRAMS.md:94-119`; `prd.md:274-280`.

Raw IP can be captured by Render/router logs, proxy headers, request logging, tracing, exception serialization, or dead-letter diagnostics. Incoming `Referer` and `User-Agent` also need treatment. Trusting arbitrary `X-Forwarded-For` enables spoofed GeoIP.

**Required invariant:** enumerate every ingress/logging layer; redact client IP, forwarding headers, referer, UA, cookies, auth, and full URL query before logs/traces/errors. Configure exact trusted proxy hops; use only platform-authenticated address transiently. Never put dimensions/UTM in metric labels. Confirm platform log/backup retention and add success/exception log-capture tests.

## H6. Enrichment remains on the redirect critical path

**Severity:** Medium/High  
**Evidence:** `ARCHITECTURE-SPINE.md:74-79`; `C4-DIAGRAMS.md:103-110`; `prd.md:258-262,281-284`.

Bot, GeoIP, and UA derivation runs before event insert. “Enrichment must not block redirect” is incompatible with network or expensive enrichment in this path.

**Required invariant:** synchronous derivation must be local, bounded, allocation-limited, and covered by the 200 ms p95 budget; no network/DNS/provider calls. Use strict time/CPU fallback to `unknown`. Pin/version local rule data. If asynchronous enrichment is required, product must relax either raw-input non-persistence or city/device capture.

## H7. C4 logical schema cannot support integrity/query guarantees

**Severity:** High  
**Evidence:** `C4-DIAGRAMS.md:177-203`; `ARCHITECTURE-SPINE.md:92-97,134-146`.

`CLICK_EVENT` and facts use opaque `text dimensions`; the stated eight-dimension key cannot be constrained or indexed. Fact uniqueness is not shown.

**Required invariant:** show scalar constrained columns. Fact primary/unique key: `(short_link_id, utc_day, referrer_key, country_key, city_key, device_key, browser_key, utm_source_key, utm_medium_key, utm_campaign_key)`; `click_count bigint NOT NULL CHECK >= 0`; exact UTC day derivation; restrictive FKs. JSON/text may be non-authoritative payload only.

## H8. Index/query contracts are absent

**Severity:** High  
**Evidence:** `ARCHITECTURE-SPINE.md:68-73,87-97,104-108`; `prd.md:136-142,216-253,260-263`.

“Indexed lookup” does not cover queue polling, owner listing, date windows, totals, retention, or arbitrary AND dimensions. Link-list totals can become N+1.

**Minimum contract:** unique path index; owner list `(owner_id, created_at DESC, id)` with cursor; grouped fact totals, never one sum query/link; ready-queue partial index `(available_at,event_id)` and lease-expiry recovery index; retention `(occurred_at,event_id)` until partitioning; fact key led by `(short_link_id,utc_day,...)`. Dimension indexes only after `EXPLAIN (ANALYZE, BUFFERS)` evidence. Benchmark fact cardinality, worst filters, Compare, zero-filled dates, cold/warm runs, owner joins, and concurrent retention.

## M1. Queue status/error fields need bounded contracts

The C4 queue lacks `available_at`, lease token, processing timestamps, and bounded error code. Persist only enumerated redacted error classes/correlation IDs; no exception payloads/stacks in rows or alerts. Add status transition checks.

## M2. Event timestamp and retry clock authority is unspecified

Use PostgreSQL time for event/lease/backoff/retention values, or define clock-skew monitoring. State which timestamp owns UTC daily attribution. Use half-open UTC API ranges.

## M3. Server UUID is not network retry deduplication

Each accepted HTTP GET may count separately, consistent with no visitor deduplication. Only internal replay of that UUID is idempotent. Do not trust a public event UUID. Define HEAD/prefetch counting explicitly.

## M4. Retained facts and deleted accounts need explicit lifecycle

Soft-delete links, retain immutable owner ID, use restrictive FKs, and authorize every fact query through owner. State user-deletion behavior and distinguish primary retention from backup retention.

## M5. Namespace normalization must be identical everywhere

Use one pure normalizer before reservation and lookup plus DB checks. Define case, trailing slash, percent-decoding, duplicate/encoded slash, and NUL behavior. Decide whether noncanonical input 404s or canonicalizes; avoid double records.

## Low-priority clarity

- “Immutable daily fact” conflicts with updating `click_count`; call keys/dimensions immutable and count monotonic.
- Show processed-marker lifecycle on raw purge.
- Bound destination/dimension bytes; `text` plus scheme validation allows abuse.
- Define exact API serialization for PostgreSQL `bigint`; JavaScript numbers lose precision.

# Edge cases scouted

1. Concurrent create/delete of a path must fail after tombstone commit, never reuse.
2. Generated-code collision retries without orphan namespace rows.
3. Delete races redirect after lookup; documented linearization decides outcome.
4. Edit races UTM snapshot; event and snapshot come from one observed link version.
5. Expired worker A cannot overwrite worker B after fencing.
6. Concurrent duplicate workers increment one fact exactly once.
7. Crash after aggregate commit/retry is a no-op.
8. Fifth attempt rollback does not increment facts; dead-letter transition is separate.
9. Dead letter at 30 days purges payload despite replayability.
10. Retention/worker contention leaves no orphan marker/event.
11. Literal `unknown`, missing, empty, repeated, malformed, mixed-case, overlong UTM values remain defined.
12. Referrer credentials/tokens/long query/malformed input never reaches dimensions/logs.
13. Spoofed forwarding headers do not control GeoIP.
14. New root route collision with active path/tombstone fails before deploy.
15. Sustained ingest cannot starve redirects while worker/dashboard/retention run.
16. Deleted-link facts stay hidden but retain FK integrity.
17. Mixed owned/unowned Compare IDs fail atomically without existence leakage.
18. `bigint` totals serialize exactly.

# Positive observations

- One PostgreSQL source avoids split-brain queue/cache behavior.
- Event UUID plus transactional marker/fact update is the correct replay foundation.
- Polling treats `NOTIFY` as a wake hint, not durable work.
- Full-tuple facts preserve AND filters after raw deletion if canonicalized and bounded.
- UTC, unknown dimensions, owner scoping, no raw IP in proposed events, and off-path aggregation are good defaults.
- Soft deletion/tombstones and `no-store` improve redirect correctness.

# Required actions

1. Resolve durability versus availability; align AD-5, FR-11, SM-8, and failure sequence.
2. Enforce permanent namespace state and route-registry collision checks.
3. Reconcile dead-letter replay with 30-day raw ceiling.
4. Specify lease claim, token fencing, attempts/backoff, and status transitions.
5. Specify marker uniqueness/acquisition and successful/dead-letter transactions.
6. Define redirect/delete/edit linearization and retention race behavior.
7. Replace opaque dimensions with constrained scalars and canonical UTM/referrer semantics.
8. Extend privacy controls through proxies, logs, traces, errors, backups, and fact cardinality.
9. Add index/query/capacity/pool budgets and concurrent benchmarks.
10. Add invariant tests for concurrency, replay, retention, UTM edges, and log redaction.

# Production-readiness checklist

- **Concurrency:** gaps in namespace state, redirect/delete ordering, lease fencing, retention races, duplicate processing.
- **Error boundaries:** insert failure and post-abort dead-letter semantics conflict with guarantees.
- **API contracts:** durability, missing UTM, HEAD/prefetch, and `bigint` serialization need definitions.
- **Backwards compatibility:** future root routes can silently break public paths.
- **Input validation:** alias rules exist; URL/UTM/referrer/dimension limits and canonicalization missing.
- **Auth/authz:** owner scoping strong in prose; lifecycle and all-or-nothing Compare tests missing.
- **N+1/query efficiency:** indexes/query shapes absent; grouped totals required.
- **Data leaks:** proxy/platform logs, referrer, UA, UTM, errors, and backups are not covered by “no raw IP.”

# Metrics/evidence

- Type coverage: not applicable; architecture artifacts only.
- Test coverage: unavailable; executable invariant tests not specified.
- Linting: not applicable.
- Performance evidence: unavailable; queue/fact/retention schemas and concurrent benchmark shapes incomplete.

# Unresolved questions

1. On event insert failure, availability or complete accounting?
2. Is “existing paths win” literal, or must future pages use `/app/*`?
3. Full referrer or registrable domain/channel?
4. Missing UTM as `unknown`, or excluded from UTM breakdowns?
5. Expected sustained rate/storage budget; partition at launch?
6. Better Auth user deletion behavior?
7. Can Render logs avoid client IP; if not, what replaces “never persisted”?
