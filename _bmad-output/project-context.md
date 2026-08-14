---
project_name: url_shortener_system
user_name: AnLap
date: 2026-07-19
sections_completed:
  - discovery
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - code_quality_rules
  - development_workflow_rules
  - critical_rules
existing_patterns_found: 0
status: complete
rule_count: 90
optimized_for_llm: true
sources:
  - planning-artifacts/prds/prd-url_shortener_system-2026-07-19/prd.md
  - planning-artifacts/ux-designs/ux-url_shortener_system-2026-07-19/DESIGN.md
  - planning-artifacts/ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md
  - planning-artifacts/architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md
  - planning-artifacts/epics.md
---

# Project Context for AI Agents

_File này chứa các quy tắc và pattern quan trọng mà AI agents phải tuân thủ khi triển khai code. Chỉ giữ các chi tiết khó suy ra hoặc dễ bị triển khai sai._

---

## Technology Stack & Versions

- Node.js `>=22.22.0`; pin exact toolchain tại bootstrap.
- TypeScript `5.x`; pin exact version trong lockfile.
- React / React DOM `19.2.7`.
- React Router Data Mode `8.2.0`.
- Vite `8.1.5`; xác minh compatibility bằng production build.
- NestJS `11.1.28` với Express 5 adapter tương thích.
- Drizzle ORM `0.45.2`; Drizzle Kit `0.31.10`.
- Better Auth `1.6.23`; chạy ESM, không dùng community Nest wrapper.
- PostgreSQL managed `18.x`.
- Apache ECharts `6.1.0`.
- Vitest `4.1.10`.
- Playwright `1.61.1`.
- Render Singapore: web/API và worker là hai service độc lập; PostgreSQL cùng region/private network.
- Exact versions được khóa bằng lockfile; agent không tự nâng dependency trong implementation story.
- Windows 10 local không phải Playwright acceptance environment; dùng CI/Linux, WSL hoặc Windows 11.

## Critical Implementation Rules

### Language-Specific Rules

- Toàn bộ runtime dùng ESM; không trộn CommonJS vào API, worker hoặc shared packages.
- TypeScript symbols dùng `camelCase`/`PascalCase`; PostgreSQL identifiers dùng `snake_case`; filenames dùng `kebab-case`.
- Domain/event IDs dùng UUID; Better Auth user ID, application `ActorId` và mọi owner FK dùng canonical `string`.
- Short path là normalized string riêng, không dùng làm database primary key.
- Dates dùng UTC `timestamptz`; API trả ISO 8601; aggregate day là UTC date.
- Missing aggregate dimensions dùng canonical `unknown`, không dùng `NULL` trong composite key.
- Business mutations chỉ đi qua application use case; controller, React và worker không ghi DB trực tiếp.
- API errors dùng RFC 9457 shape: `type`, `title`, `status`, `detail`, `instance`, optional `code`, `fieldErrors`.
- Không bắt exception chung rồi đổi mọi unique violation thành alias collision; chỉ SQLSTATE `23505` của named namespace constraint được map.
- Async external effects như verification email không chạy bên trong database transaction.

### Framework-Specific Rules

- `apps/web` chỉ import generated client/types từ `packages/contracts`; không viết DTO hoặc API schema song song.
- React Router Data Mode loaders/actions sở hữu route data và mutations; URL/router state giữ search, date range, filters và Compare selection.
- NestJS DTO runtime validation là API contract source of truth và phát OpenAPI; generated files không chỉnh tay.
- Nest bootstrap bắt buộc `bodyParser: false`; mount official Better Auth `toNodeHandler(auth)` tại `/api/auth/*splat` trước JSON/urlencoded parsers.
- Không dùng community Better Auth Nest wrapper, custom session store hoặc auth guard định nghĩa identity thứ hai.
- HTTP controllers và worker entrypoints chỉ gọi `packages/application`; `packages/domain` không import React, NestJS, Drizzle hoặc Better Auth.
- `apps/worker` không import HTTP controllers.
- Repositories từ `packages/db` phải transaction-scoped qua application `UnitOfWork`.
- Same-origin browser client luôn gửi credentials; unsafe methods chỉ chấp nhận exact configured `Origin` và `Sec-Fetch-Site: same-origin`.
- Không dùng CSRF token fallback cho public browser contract.
- ECharts chỉ là visual summary; dữ liệu thiết yếu phải có direct label hoặc captioned table fallback.
- UI dùng shared DESIGN tokens/components; không tạo duplicate component có semantics khác.

### Testing Rules

- Mọi story phải để lại test chạy được; không mock database/concurrency behavior cần PostgreSQL chứng minh.
- CI bắt buộc: typecheck, unit tests, production build, architecture boundaries, OpenAPI generated diff, migration lint và auth bootstrap integration.
- Auth integration phải chứng minh JSON request không treo, cookie được phát, session resolve đúng, CSRF valid được nhận và invalid/missing headers trả 403.
- Namespace tests phải bao phủ active collision, Code/Alias collision, Reserved Path, Tombstone, canonicalization và concurrent allocation.
- Click durability tests phải chứng minh mỗi successful human `302` có đúng một durable event; commit failure trả `503` và không redirect.
- Worker tests dùng real PostgreSQL semantics cho `FOR UPDATE SKIP LOCKED`, lease fencing, crash/reclaim, retries, dead-letter và idempotent fact UPSERT.
- Retention tests bao phủ UTC 30-day boundary, bounded batch rollback, singleton lease và reconciliation-loss alert.
- Analytics tests kiểm tra UTC zero-fill, AND filters, ownership, `unknown`, stable series identity và chart/table parity.
- Benchmark redirect: 100 rps, 20 connections, 10 phút, p95 ≤200 ms.
- Benchmark dashboard: 100.000 facts trong 30 ngày, 20 concurrent requests sau warm-up, p95 ≤2 giây.
- Playwright acceptance chạy trên CI/Linux, WSL hoặc Windows 11; không dùng Windows 10 local làm acceptance evidence.
- Không bỏ qua failing test, nới SLO hoặc dùng fake/mock workaround để đánh dấu story done.

### Code Quality & Style Rules

- Giữ code files dưới 200 dòng khi có logical separation rõ; không tách Markdown/config chỉ để đạt giới hạn.
- Ưu tiên YAGNI, KISS, DRY; không tạo abstraction cho một implementation hoặc scaffolding “để sau”.
- Dùng cấu trúc cố định: `apps/web` cho presentation/browser state; `apps/api` cho HTTP composition; `apps/worker` cho queue/retention; `packages/application` cho use cases/ports/UnitOfWork; `packages/domain` cho pure rules; `packages/db` cho Drizzle; `packages/contracts` cho generated output; `packages/observability` cho telemetry.
- Comments chỉ giải thích invariant hoặc logic khó suy ra; không lặp lại code.
- Events đặt tên past tense, ví dụ `click-recorded`.
- Config được validate khi process startup; production secrets chỉ từ Render secret environment; không có fallback secret.
- Logs là structured JSON với request/event correlation ID.
- Không log raw IP, password, token, cookie, verification secret, full referrer hoặc full Destination query.
- Migrations forward-only theo expand/migrate/contract; Drizzle-generated SQL phải được review.
- Generated contracts không chỉnh tay; thay DTO/OpenAPI source rồi regenerate.
- Design/behavior authority: `DESIGN.md` sở hữu visual tokens, `EXPERIENCE.md` sở hữu UX behavior; mockups không được override spine.

### Development Workflow Rules

- Triển khai theo thứ tự Epic `1 → 2 → 3 → 4`; story chỉ dùng outputs của stories trước.
- Mỗi story theo vòng: Create Story → Validate Story → Dev Story → tests → Code Review.
- Trước implementation phải đọc `README.md`, story hiện tại, `project-context.md`, Architecture spine và các UX sections được story tham chiếu.
- Sau thay đổi code: chạy compile/typecheck và tests liên quan; trước push chạy toàn bộ required CI gates.
- Không commit hoặc push nếu tests fail.
- Commit theo conventional commits, không có AI reference; mỗi commit chỉ chứa thay đổi của story hiện tại.
- Không commit `.env`, credentials, API keys, OAuth secrets hoặc production URLs có secrets.
- OpenAPI changes phải commit generated contract diff cùng source DTO change.
- Migrations chạy một lần trước cutover, có advisory lock, N/N-1 compatibility và schema readiness check.
- API và worker deploy/restart độc lập; cả hai xử lý SIGTERM và đóng pools/listeners trong bounded deadline.
- Nếu implementation cần thay invariant Architecture, dừng story và cập nhật Architecture bằng AD mới; không âm thầm thêm Redis, BullMQ hoặc auth owner thứ hai.
- Google Story 1.6 dùng Better Auth `1.6.23` OAuth authorization-code flow với database-backed signed-cookie `state` và PKCE S256. OIDC `nonce`, cryptographic ID-token validation và atomic state-consume là security hardening deferred; không tuyên bố chúng đã đạt, cũng không tự dựng OAuth callback, code exchange, token/session/state/nonce store. Story 1.7 vẫn độc quyền explicit linking sau fresh re-authentication.
- Redis cache chỉ được xem xét sau benchmark NFR-1 thất bại và có measured bottleneck.

### Critical Don't-Miss Rules

- Một `short_path_registry` sở hữu mọi Code/Alias vĩnh viễn; delete chuyển Tombstone, không xóa/reuse path.
- Exact one-segment root path được lookup registry trước SPA fallback; fixed reserved routes được xử lý trước.
- Redirect truth chỉ từ PostgreSQL; không thêm cache trong MVP.
- Active redirect trả `302` + `Cache-Control: no-store`; missing/tombstoned trả `404`.
- Human click phải commit durable Click Event trước response `302`; commit/lookup failure trả `503` và không redirect.
- Bot/link preview vẫn `302` nhưng không tạo Click Event.
- Raw IP chỉ dùng in-memory cho local enrichment, không persist hoặc log; chỉ tin configured proxy chain.
- Enrichment failure dùng `unknown` và không chặn redirect.
- PostgreSQL Click Event rows là durable queue; LISTEN/NOTIFY chỉ là wake hint, polling là bắt buộc.
- Worker claim bằng `FOR UPDATE SKIP LOCKED`; mọi completion/retry/dead-letter transition phải match current `lease_token`.
- Fact increment chỉ sau `processed_event ... ON CONFLICT DO NOTHING RETURNING`; marker, fact và event state commit atomically.
- Daily fact key gồm UTC day, link và toàn bộ dimension tuple; dimensions non-null với canonical `unknown`.
- Raw/dead-letter events xóa sau 30 ngày; processed-event ledger không cascade; facts được giữ.
- Mọi authenticated use case scope repository bằng canonical `ActorId`; Compare chỉ nhận 2–5 owned links trong một query.
- Create dùng owner-scoped idempotency key; edit/delete dùng expected version và reconcile trước retry sau timeout.
- UTM composition chỉ có một implementation trong `packages/application`; thay duplicate keys, giữ query/fragment và encode một lần.
- Charts không dùng status colors làm series, không dual axis/rainbow/hue thứ chín; `Other` sau tám categories.
- UI phải keyboard-operable, target 44×44px, reflow tại 320 CSS px/400% zoom và có chart table fallback.

---

## Usage Guidelines

**Cho AI agents:**

- Đọc file này trước khi triển khai code.
- Tuân thủ toàn bộ rules; khi chưa rõ, chọn phương án hạn chế hơn.
- Đối chiếu Architecture/UX spine khi một story có dấu hiệu xung đột.
- Cập nhật file khi project chấp nhận invariant hoặc pattern mới.

**Cho maintainers:**

- Giữ file lean, chỉ lưu chi tiết agents khó tự suy ra.
- Cập nhật khi stack, architecture hoặc workflow thay đổi.
- Xóa rules lỗi thời hoặc đã được compiler/tooling enforce hoàn toàn.

**Last Updated:** 2026-07-19

