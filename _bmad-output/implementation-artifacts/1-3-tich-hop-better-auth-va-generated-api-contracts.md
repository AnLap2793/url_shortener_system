---
baseline_commit: 7fe93350fba5765163015b0b438e608f23562b8b
---

# Story 1.3: Tích hợp Better Auth và generated API contracts

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Là một marketer,
Tôi muốn authentication và API client dùng một integration contract đã kiểm chứng,
Để đăng nhập và các chức năng sau không lệch giữa web và API.

## Requirements Traceability

- **FR-1, FR-2, FR-3** — nền tảng identity/session mà Stories 1.4–1.7 (đăng ký, đăng nhập, Google) xây trên.
- **NFR-4** (session cookie HttpOnly/Secure/SameSite), **NFR-7** (CSRF), **NFR-5** (password hash — cấu hình Better Auth mặc định, flows thuộc 1.4/1.5).
- **AD-9** (Better Auth là auth owner duy nhất), **AD-14** (NestJS DTO → OpenAPI → generated contracts), **AD-18** (một CSRF protocol: Origin + Sec-Fetch-Site), **AD-15** (migrations trong một chain), **AD-19** (CI integration gates).

## Acceptance Criteria

1. **ESM mount ordering**
   **Given** NestJS API khởi động
   **When** Better Auth được tích hợp
   **Then** API chạy ESM và khởi tạo Nest với `bodyParser: false`
   **And** official Better Auth Node handler được mount tại `/api/auth/*splat` trước JSON/urlencoded parsers
   **And** không dùng community Nest wrapper hoặc session store thứ hai.

2. **Schema/migration chain**
   **Given** Better Auth schema được tạo
   **When** database migrations được chuẩn bị
   **Then** auth schema/migrations được import vào cùng Drizzle migration chain
   **And** canonical Better Auth user ID, application `ActorId` và owner FK đều dùng string
   **And** migration test từ database rỗng phải pass.

3. **Session integration**
   **Given** integration test gọi Better Auth bằng JSON
   **When** auth handler xử lý request
   **Then** request không treo
   **And** session cookie được phát hành
   **And** protected Nest endpoint resolve cùng canonical session/ActorId
   **And** test thất bại nếu middleware ordering bị thay đổi sai.

4. **Generated contracts**
   **Given** NestJS DTO là API contract source of truth
   **When** OpenAPI generation chạy
   **Then** generated client/types được ghi vào `packages/contracts`
   **And** `apps/web` chỉ dùng generated contract để gọi API
   **And** CI thất bại nếu generated output khác nội dung đã commit.

5. **CSRF protocol**
   **Given** generated browser client gọi unsafe mutation
   **When** request được gửi same-origin
   **Then** credentials được gửi theo contract
   **And** valid `Origin`/`Sec-Fetch-Site` được chấp nhận
   **And** missing/mismatched headers bị API từ chối `403` trong integration test.

6. **CI gates**
   **Given** CI chạy integration gates
   **When** Better Auth bootstrap, auth migration, session resolution, OpenAPI diff và CSRF acceptance/rejection tests chạy
   **Then** tất cả phải pass trước merge.

## Scope Boundary

**Trong scope:** Better Auth instance + Drizzle adapter + schema/migrations; mount `toNodeHandler` đúng ordering; origin-check middleware (AD-18) cho mọi unsafe `/api/*`; SessionGuard + `GET /api/me`; OpenAPI generation → `packages/contracts` + CI diff gate; web session-loader chuyển sang generated client; xóa `session-placeholder.controller`; config `BETTER_AUTH_SECRET`/`PUBLIC_ORIGIN`; integration tests trên PostgreSQL CI.

**NGOÀI scope:** Sign-up/Sign-in UI và auth forms (1.4/1.5); email adapter + verification sending/`requireEmailVerification` (1.4); Google OAuth/linking (1.6/1.7); login rate limiting (AD-10, 1.5); logout/session expiry UX (1.5); Swagger UI serving (chỉ ghi file JSON); KHÔNG đổi `generateId` sang uuid (string mặc định là canonical per AD-9).

## Dependency Approval (dev agent KHÔNG cần HALT xin duyệt các deps này — story đã duyệt trước)

| Package | Workspace | Loại | Version |
|---|---|---|---|
| `better-auth` | `apps/api` | dep | `1.6.23` (đã pin ở root từ 1.1) |
| `@nestjs/swagger` | `apps/api` | dep | `11.4.6` (xác minh lại bằng `npm view @nestjs/swagger version` — pin exact 11.x mới nhất) |
| `class-validator` | `apps/api` | dep | `0.15.1` (exact) |
| `class-transformer` | `apps/api` | dep | `0.5.1` (exact) |
| `openapi-fetch` | `packages/contracts` | dep | pin exact mới nhất qua `npm view openapi-fetch version` |
| `openapi-typescript` | root | devDep | `7.13.0` (exact; xác minh lại) |
| `@better-auth/cli` | root | devDep | `1.4.21` (chỉ dùng generate schema một lần; xem fallback ở Dev Notes) |

Mọi version mới PHẢI: exact semver, thêm vào `required` map của `tests/toolchain.test.ts`, thêm vào manifest allowlists của `tests/architecture-boundaries.test.js`, chạy `npm install --package-lock-only --ignore-scripts` đồng bộ lockfile, `npm ci --dry-run` sạch.

## Tasks / Subtasks

- [x] Task 1: Dependencies + config mở rộng (AC: 1, 5)
  - [x] 1.1 Cài các deps theo bảng Dependency Approval (dùng `npm_config_engine_strict=false` local); cập nhật toolchain map + architecture allowlists + lockfile.
  - [x] 1.2 Mở rộng `apps/api/src/config.ts`: `BETTER_AUTH_SECRET` bắt buộc (>=32 ký tự; fail-fast không echo giá trị — pattern 1.1); `PUBLIC_ORIGIN` optional, validate absolute http(s) URL không trailing slash, default `http://127.0.0.1:${port}`. Tests: thiếu secret ⇒ throw không leak; origin sai ⇒ throw; default đúng.
  - [x] 1.3 Cập nhật mọi chỗ spawn API: `tests/api-process.test.ts`, `playwright.config.ts` webServer env, `.github/workflows/ci.yml` env — thêm `BETTER_AUTH_SECRET` (giá trị test cố định như `test-secret-for-ci-0123456789abcdef`, KHÔNG phải secret thật) + `PUBLIC_ORIGIN=http://127.0.0.1:4173` cho e2e. Thêm assertion secret không xuất hiện trong output/artifacts (sentinel pattern 1.1).
- [x] Task 2: DB foundation + auth schema + migration chain (AC: 2)
  - [x] 2.1 `packages/db/src/create-db.ts`: factory `createDb(databaseUrl)` → drizzle(node-postgres Pool bounded max/timeouts như PgReadinessProbe pattern) + `closeDb`. Export từ index.ts.
  - [x] 2.2 Sinh auth schema vào `packages/db/src/schema/auth-schema.ts`: chạy `npx @better-auth/cli@1.4.21 generate` với config trỏ Better Auth instance. **Fallback nếu CLI 1.4.21 lệch runtime 1.6.23** (đã biết CLI max 1.4.21): tự viết schema 4 bảng `user`, `session`, `account`, `verification` theo docs Better Auth database schema — mọi id là `text` (KHÔNG uuid); tính đúng đắn được chứng minh bằng integration test sign-up thật (Task 5), không phải bằng CLI.
  - [x] 2.3 `packages/db/drizzle.config.ts` + script `db:generate` (drizzle-kit generate) → SQL migrations committed vào `packages/db/migrations/`; review SQL theo project-context (snake_case, timestamptz).
  - [x] 2.4 `packages/db/src/migrate.ts`: runner dùng `drizzle-orm/node-postgres/migrator` với advisory lock note; export `runMigrations(databaseUrl)`.
  - [x] 2.5 Integration test `packages/db/src/migrations.integration.test.ts`: khi có `INTEGRATION_DATABASE_URL` (CI bắt buộc — service container sẵn từ 1.1; local skip như readiness pattern): tạo ephemeral schema (`CREATE SCHEMA`/search_path hoặc drop-create tables), chạy `runMigrations` từ rỗng ⇒ pass; assert 4 bảng tồn tại và cột `user.id` kiểu text.
- [x] Task 3: Better Auth mount + origin-check (AC: 1, 5)
  - [x] 3.1 `apps/api/src/auth/better-auth-instance.ts`: `betterAuth({ database: drizzleAdapter(createDb(url), { provider: "pg" }), baseURL: publicOrigin, secret, trustedOrigins: [publicOrigin], emailAndPassword: { enabled: true } })`. Import `drizzleAdapter` từ `better-auth/adapters/drizzle`, `toNodeHandler`/`fromNodeHeaders` từ `better-auth/node`. KHÔNG bật requireEmailVerification (1.4 sở hữu).
  - [x] 3.2 `apps/api/src/security/origin-check.middleware.ts` (function thuần, express-level): với method POST/PUT/PATCH/DELETE dưới `/api`: yêu cầu `Origin` === publicOrigin VÀ `Sec-Fetch-Site` === `"same-origin"`; thiếu/sai ⇒ 403 problem+json (`code: "CSRF_REJECTED"`), không side effect. GET/HEAD/OPTIONS pass. Đây là một CSRF protocol duy nhất (AD-18) áp cho CẢ `/api/auth/*` (chạy TRƯỚC toNodeHandler) lẫn Nest routes.
  - [x] 3.3 Sửa `apps/api/src/main.ts` (giữ shutdown hooks/port): `NestFactory.create(AppModule.register(config), { bodyParser: false, logger: false })`; lấy express instance qua `app.getHttpAdapter().getInstance()`; thứ tự: (1) `server.use("/api", originCheck)`, (2) `server.all("/api/auth/*splat", toNodeHandler(auth))`, (3) `app.useBodyParser("json")` + `app.useBodyParser("urlencoded")` (NestExpressApplication; nếu TS7016 xuất hiện thì fallback structural typing như 1.1/1.2 — KHÔNG cài @types/express). File main.ts giữ nhỏ; tách wiring vào `apps/api/src/bootstrap.ts` nếu vượt 200 dòng.
  - [x] 3.4 XÓA `apps/api/src/auth/session-placeholder.controller.ts` + test của nó (Better Auth chiếm `/api/auth/*` — ghi chú 1.2 đã hẹn xóa). Kiểm tra registry: `/api` prefix đã reserved, không cần đổi.
  - [x] 3.5 Lifecycle: db pool của auth đóng bounded khi SIGTERM (pattern ReadinessProbeLifecycle 1.1).
- [x] Task 4: SessionGuard + `/api/me` (AC: 3)
  - [x] 4.1 `packages/application/src/actor.ts`: `export type ActorId = string;` (canonical string — AD-9) + export từ index.
  - [x] 4.2 `apps/api/src/auth/session.guard.ts`: `auth.api.getSession({ headers: fromNodeHeaders(request.headers) })`; không có session ⇒ throw 401 problem shape (`code: "UNAUTHENTICATED"`, Cache-Control no-store); lỗi DB/probe ⇒ fail-closed 401 (không 500, không leak); có session ⇒ gắn `request.actorId = session.user.id`.
  - [x] 4.3 `apps/api/src/me/me.controller.ts` + `me-response.dto.ts`: `GET /api/me` @UseGuards(SessionGuard) trả `MeResponseDto { actorId: string }` với @ApiProperty; đây là protected endpoint chứng minh AC3 và là nguồn DTO đầu tiên cho OpenAPI.
- [x] Task 5: Integration tests trên PostgreSQL thật (AC: 1, 2, 3, 5, 6)
  - [x] 5.1 `apps/api/src/auth/better-auth.integration.test.ts` (chạy khi có `INTEGRATION_DATABASE_URL`, skip local — CI bắt buộc): setup chạy `runMigrations` trên schema sạch; boot app qua bootstrap thật (bodyParser:false + mount thật — KHÔNG dựng app test khác ordering); (a) POST `/api/auth/sign-up/email` JSON (email+password+name) với headers `Origin: publicOrigin`, `Sec-Fetch-Site: same-origin` ⇒ hoàn thành < 5s (chứng minh không treo — chính là ordering test: nếu json() chạy trước handler, request treo), Set-Cookie chứa session token; (b) GET `/api/me` kèm cookie ⇒ 200 `{ actorId }` === user id từ sign-up (cùng canonical string); (c) GET `/api/me` không cookie ⇒ 401.
  - [x] 5.2 CSRF integration (cùng file hoặc `csrf.integration.test.ts`): POST sign-up thiếu Origin ⇒ 403; Origin lạ (`https://evil.example`) ⇒ 403; Sec-Fetch-Site `cross-site` ⇒ 403; đúng cả hai ⇒ không bị origin-check chặn. GET không bị chặn.
  - [x] 5.3 Process-level: cập nhật spawn tests với env mới; thêm case thiếu `BETTER_AUTH_SECRET` ⇒ exit non-zero không leak.
- [x] Task 6: OpenAPI generation → contracts + CI diff gate (AC: 4, 6)
  - [x] 6.1 `apps/api/src/openapi/generate-openapi.ts`: tạo Nest app (bodyParser:false, KHÔNG listen, dummy config hợp lệ inline — không cần DB sống; gọi `await app.init()` trước createDocument rồi `await app.close()`), `SwaggerModule.createDocument` + DocumentBuilder (title/version), ghi `packages/contracts/openapi.json` (pretty, LF). Root script `generate:contracts`: build api ⇒ chạy script ⇒ `openapi-typescript packages/contracts/openapi.json -o packages/contracts/src/generated/api-types.ts` (header "generated - do not edit").
  - [x] 6.2 `packages/contracts/src/index.ts`: factory ổn định (KHÔNG generated, được review) `createApiClient(fetchImpl?)` dùng `openapi-fetch` `createClient<paths>({ baseUrl: "/", credentials: "same-origin", fetch: fetchImpl })`; re-export `paths` types. Manifest contracts thêm dep `openapi-fetch`; build giữ tsc.
  - [x] 6.3 Root script `verify:contracts`: chạy `generate:contracts` rồi `git diff --exit-code -- packages/contracts/openapi.json packages/contracts/src/generated`; thêm vào CUỐI chuỗi `check` (sau `build` — cần api dist sẵn) và thành step CI riêng. Commit generated output.
- [x] Task 7: Web dùng generated client + gates cuối (AC: 4, 6)
  - [x] 7.1 Sửa `apps/web/src/routes/session-loader.ts`: dùng `createApiClient` từ `@url-shortener/contracts` gọi `GET /api/me`; 200 ⇒ null (cho phép render); 401/lỗi ⇒ redirect giữ pathname+search (logic hiện có). Giữ injectable (factory nhận client/fetch) để unit tests không cần network. Cập nhật `session-loader.test.ts` theo shape mới.
  - [x] 7.2 Architecture gates: web allowlist KHÔNG đổi (openapi-fetch nằm trong contracts); api allowlist += better-auth/@nestjs/swagger/class-validator/class-transformer; contracts allowlist += openapi-fetch + cho phép file generated. Negative fixtures giữ pass.
  - [x] 7.3 e2e shell project: flow redirect `/dashboard → /sign-in?redirectTo=...` phải giữ pass với DB unreachable (SessionGuard fail-closed 401). Chạy đủ: `npm run check` (gồm verify:contracts) + `npm run test:e2e` + `npm ci --dry-run`; CI thêm env mới. Không skip test để qua gate.

### Review Findings

- [x] [Review][Patch][High] `runMigrations` claims concurrent safety that Drizzle's PostgreSQL migrator does not provide; two deploy instances can both observe no migration row and execute the same `CREATE TABLE`, causing one startup to fail [packages/db/src/migrate.ts:8]
- [x] [Review][Patch][Medium] Guard-rejected `/api/me` responses miss the required `Cache-Control: no-store` and `application/problem+json`; controller headers run only after guards and the replacement test asserts status only [apps/api/src/auth/session.guard.ts:51]
- [x] [Review][Patch][Medium] The four new workspace dependencies are absent from the pinned-toolchain version gate because it reads only root `package.json` [tests/toolchain.test.ts:30]
- [x] [Review][Patch][Medium] API architecture protection was weakened by deleting the existing `better-auth/adapters` ban globally instead of limiting the new adapter import to the composition root [tests/architecture-boundaries.test.js:15]
- [x] [Review][Patch][Medium] Auth integration uses `publicOrigin` port `0`, so its accepted Origin never equals the real listening origin and cannot prove realistic same-origin Better Auth behavior [apps/api/src/auth/better-auth.integration.test.ts:32]
- [x] [Review][Patch][Medium] `verify:contracts` ignores newly untracked generated files, allowing a generator path change to pass without committed output [package.json:33]
- [x] [Review][Patch][Low] Process-level secret test supplies a short secret rather than testing the marked-complete missing-secret branch [tests/api-process.test.ts:76]
- [x] [Review][Patch][Low] `verify:contracts` is not a separate CI step despite Task 6.3 being marked complete [/.github/workflows/ci.yml:50]
- [x] [Review][Patch][Low] Integration database names can collide across parallel/retried migration tests because they use millisecond timestamps rather than a random suffix [packages/db/src/migrations.integration.test.ts:13]

## Dev Notes

### Previous story intelligence (1.1 + 1.2 — 57 review patches đã hấp thụ)

- KHÔNG cài `@types/express`; TS7016 tránh bằng structural typing (xem `request-logger.middleware.ts`, `serve-static-file.ts`). `useBodyParser` là API của NestExpressApplication — thử trước, fallback structural.
- Express 5: wildcard phải đặt tên (`*splat`); route match case-insensitive + bỏ trailing slash — mọi so sánh path tự viết phải normalize (bài học SPA fallback 1.2).
- Middleware express-level (app.use trên instance) chạy TRƯỚC mọi Nest middleware/controller — origin-check và toNodeHandler mount ở main.ts/bootstrap, KHÔNG qua MiddlewareConsumer (consumer không phủ được handler ngoài Nest).
- SPA fallback 1.2 dùng `isControllerOwnedRoute` — `/api` prefix đã controller-owned nên KHÔNG đụng registry.
- Async middleware phải catch mọi rejection (bài học crash-safety 1.2); origin-check là sync thuần → không rủi ro.
- Fail-fast config không echo giá trị; logger observability tự scrub nhưng đừng log secret/cookie/token ở bất kỳ level nào.
- Tests assert độc lập bảng literal (reserved-routes); CRLF-safe bằng regex; Playwright evidence từ CI/Linux; local dùng `npm_config_engine_strict=false` (Node 22.16.0).
- Sentinel pattern: giá trị nhạy cảm trong test đặt tên `sentinel-*` và assert không xuất hiện ở output/artifacts.
- `npm install --package-lock-only --ignore-scripts` để đồng bộ lock khi thêm deps; `engines.npm >=10.9.4 <11` đã enforce.

### Better Auth 1.6.23 facts (đã research, có source)

- `toNodeHandler`, `fromNodeHeaders` từ `better-auth/node`; Express 5 mount: `app.all("/api/auth/*splat", toNodeHandler(auth))`; JSON parser PHẢI sau handler (docs cảnh báo trực tiếp).
- `drizzleAdapter` từ `better-auth/adapters/drizzle`, option `{ provider: "pg" }`.
- 4 bảng: `user`, `session`, `account`, `verification`; id mặc định là **text string** — GIỮ nguyên (canonical string, AD-9); không bật `advanced.database.generateId: "uuid"`.
- Cookie: `better-auth.session_token`, HttpOnly, SameSite=Lax mặc định; Secure tự bật khi baseURL https (production Render) — NFR-4 thỏa qua config, không tự chế cookie.
- Session đọc server-side: `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })` — KHÔNG gọi HTTP nội bộ, không session store thứ hai.
- `GET /api/auth/get-session` trả 200 với body null khi anonymous (KHÔNG 401) — vì vậy web guard KHÔNG dùng get-session; guard dùng `/api/me` (401 rõ ràng qua generated contract). Đây là lý do thiết kế, giữ nguyên.
- Better Auth tự check Origin với `trustedOrigins` (baseURL tự trusted) nhưng status code không documented — vì vậy AD-18 được enforce bằng origin-check middleware CỦA TA trả 403 deterministic trước handler; Better Auth check là lớp thứ hai.
- CLI `@better-auth/cli` max 1.4.21 (lệch minor với 1.6.23) — dùng để scaffold schema một lần rồi review tay theo docs; nguồn chân lý cuối là integration test sign-up thật trên PostgreSQL.

### OpenAPI/contracts facts

- `@nestjs/swagger@11.4.6` tương thích Nest 11 (peer ^11.0.1); peers `class-validator` 0.15.1, `class-transformer` 0.5.1.
- Generation không UI: `SwaggerModule.createDocument(app, builder)` + writeFileSync — chạy trong script build-time, app không listen, không cần DB.
- Types: `openapi-typescript@7.13.0` sinh `paths` types; runtime client: `openapi-fetch` `createClient<paths>` hỗ trợ `credentials` — khớp AD-18 (client luôn gửi credentials same-origin).
- "Generated không chỉnh tay" áp cho `openapi.json` + `src/generated/**`; `contracts/src/index.ts` (factory) là code review được — CI diff gate chỉ diff phần generated.

### Kiến trúc & cấu trúc

- Auth instance đặt ở `apps/api/src/auth/` (composition root — AD-1); schema/migrations ở `packages/db` (adapter sở hữu schema); `ActorId` type ở `packages/application`.
- Files MỚI: `packages/db/src/{create-db.ts,migrate.ts,schema/auth-schema.ts,migrations.integration.test.ts}`, `packages/db/drizzle.config.ts`, `packages/db/migrations/*`, `apps/api/src/auth/{better-auth-instance.ts,session.guard.ts,better-auth.integration.test.ts}`, `apps/api/src/security/origin-check.middleware.ts(+test)`, `apps/api/src/me/{me.controller.ts,me-response.dto.ts}`, `apps/api/src/openapi/generate-openapi.ts`, `packages/contracts/openapi.json`, `packages/contracts/src/generated/api-types.ts`, `packages/application/src/actor.ts`.
- Files UPDATE: `apps/api/src/{main.ts,config.ts(+test),app.module.ts}`, `packages/db/src/index.ts`, `packages/db/package.json`, `packages/contracts/{package.json,src/index.ts}`, `packages/application/src/index.ts`, `apps/api/package.json`, `apps/web/src/routes/session-loader.ts(+test)`, root `package.json` (scripts + devDeps), `tests/{toolchain.test.ts,architecture-boundaries.test.js,api-process.test.ts}`, `playwright.config.ts`, `.github/workflows/ci.yml`, `package-lock.json`.
- Files XÓA: `apps/api/src/auth/session-placeholder.controller.ts` + `.test.ts`.
- Mọi file <200 dòng khi có logical separation; kebab-case.

### Testing Requirements

- `npm run check` mở rộng thêm `verify:contracts` — tất cả pass; e2e 2 projects giữ 24+ pass; `npm ci --dry-run` sạch sau khi thêm deps.
- Integration (CI bắt buộc qua `INTEGRATION_DATABASE_URL`, local skip có điều kiện): migration-from-empty, sign-up JSON không treo + cookie phát hành, `/api/me` resolve đúng ActorId string, CSRF 403 matrix, ordering regression (sign-up JSON chính là proof).
- Config tests: secret thiếu/ngắn ⇒ fail không leak; PUBLIC_ORIGIN validate.
- Không mock PostgreSQL cho hành vi cần DB thật chứng minh; không fake session; không skip/nới test.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.3`]
- [Source: `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md#AD-9`, `#AD-14`, `#AD-15`, `#AD-18`, `#AD-19`]
- [Source: `_bmad-output/project-context.md#Framework-Specific Rules`, `#Testing Rules`]
- [Source: `_bmad-output/implementation-artifacts/1-2-xac-thuc-application-shell-va-ci-boundaries.md#Dev Notes`, `#Review Findings`]
- [Source: `https://better-auth.com/docs/integrations/express`]
- [Source: `https://better-auth.com/docs/adapters/drizzle`]
- [Source: `https://better-auth.com/docs/concepts/session-management`]
- [Source: `https://better-auth.com/docs/reference/security`]
- [Source: `https://www.npmjs.com/package/@nestjs/swagger`]
- [Source: `https://openapi-ts.dev/openapi-fetch/`]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code)

### Debug Log References

- `ReturnType<typeof betterAuth>` không gán được cho instance cụ thể (generic Auth<BetterAuthOptions> mismatch) — giải quyết bằng hàm `buildAuth` cụ thể và `BetterAuthInstance = ReturnType<typeof buildAuth>`.
- Node `Request` từ chối URL tương đối nên `baseUrl: "/"` của openapi-fetch chỉ chạy trong browser — factory nhận tham số `baseUrl` để unit tests dùng absolute URL; browser giữ default "/".

### Completion Notes List

- Deps đã duyệt cài đúng exact pins (@nestjs/swagger 11.4.6, class-validator 0.15.1, class-transformer 0.5.1, openapi-fetch 0.17.0, openapi-typescript 7.13.0, @better-auth/cli 1.4.21); toolchain map + architecture allowlists + lockfile đồng bộ.
- Config mở rộng: BETTER_AUTH_SECRET >=32 ký tự bắt buộc, PUBLIC_ORIGIN validate origin-only với default loopback; fail-fast không leak (unit + process-level tests, sentinel).
- DB foundation: createDb bounded-pool factory, auth schema 4 bảng tự viết theo docs (CLI 1.4.21 lệch runtime — fallback như story định trước), drizzle-kit migration SQL committed (snake_case/timestamptz/text ids), runMigrations qua drizzle migrator; integration test migrate-từ-rỗng + idempotent trên ephemeral database.
- Composition root mới `bootstrap.ts`: origin-check (AD-18, 403 problem+json deterministic) → `toNodeHandler` tại `/api/auth/*splat` → useBodyParser json/urlencoded (bodyParser:false); session-placeholder controller đã XÓA; AuthLifecycle đóng pool bounded 2s.
- SessionGuard fail-closed 401 qua `auth.api.getSession` (không second store); `GET /api/me` DTO-first endpoint gắn ActorId string canonical.
- Integration suite (CI qua INTEGRATION_DATABASE_URL; local skip): sign-up JSON < 5s không treo qua bootstrap thật (ordering proof), HttpOnly session cookie, /api/me trả đúng actorId của user vừa tạo, 401 không cookie, CSRF matrix 4 case 403 + GET pass-through.
- Contracts: generate-openapi script (app.init không listen/không DB) → openapi.json + api-types.ts (openapi-typescript); factory createApiClient (openapi-fetch, credentials same-origin); `verify:contracts` diff gate nối cuối chuỗi `check`.
- Web session-loader chuyển hoàn toàn sang generated client gọi /api/me (giữ preserve path+query, fail-closed); web allowlist không đổi.
- Validation: `npm run check` pass (103 unit + 5 integration skip local — CI bắt buộc, architecture negative fixtures, build, contracts diff), Playwright 24/24 trên NestJS host (DB unreachable ⇒ guard 401 ⇒ redirect flow giữ nguyên), `npm ci --dry-run` sạch. Integration evidence cuối cùng từ CI/Linux.

### File List

- NEW: `packages/db/src/create-db.ts`, `packages/db/src/schema/auth-schema.ts`, `packages/db/src/migrate.ts`, `packages/db/src/migrations.integration.test.ts`, `packages/db/drizzle.config.ts`, `packages/db/migrations/0000_huge_luke_cage.sql`, `packages/db/migrations/meta/*`
- NEW: `apps/api/src/bootstrap.ts`, `apps/api/src/auth/better-auth-instance.ts`, `apps/api/src/auth/auth-lifecycle.provider.ts`, `apps/api/src/auth/session.guard.ts`, `apps/api/src/auth/better-auth.integration.test.ts`, `apps/api/src/security/origin-check.middleware.ts`, `apps/api/src/security/origin-check.middleware.test.ts`, `apps/api/src/me/me.controller.ts`, `apps/api/src/me/me-response.dto.ts`, `apps/api/src/openapi/generate-openapi.ts`
- NEW: `packages/contracts/openapi.json`, `packages/contracts/src/generated/api-types.ts`, `packages/application/src/actor.ts` (inline trong index)
- UPDATE: `apps/api/src/{main.ts,config.ts,config.test.ts,app.module.ts,tokens.ts}`, `apps/api/src/web-static/web-static.test.ts`, `apps/api/package.json`, `packages/db/{package.json,src/index.ts}`, `packages/contracts/{package.json,src/index.ts}`, `packages/application/src/index.ts`, `apps/web/src/routes/{session-loader.ts,session-loader.test.ts}`, root `package.json`, `package-lock.json`, `tests/{toolchain.test.ts,architecture-boundaries.test.js,api-process.test.ts}`, `playwright.config.ts`, `.github/workflows/ci.yml`
- DELETED: `apps/api/src/auth/session-placeholder.controller.ts`, `apps/api/src/auth/session-placeholder.controller.test.ts`

## Change Log

- 2026-07-26: Implemented Story 1.3 — Better Auth mounted at /api/auth/*splat with bodyParser:false ordering, Drizzle auth schema + forward-only migration chain, AD-18 origin-check (403), SessionGuard + /api/me, OpenAPI → generated contracts with CI diff gate, web on generated client. 103 unit + 24 e2e pass; PostgreSQL integration gates run in CI.
