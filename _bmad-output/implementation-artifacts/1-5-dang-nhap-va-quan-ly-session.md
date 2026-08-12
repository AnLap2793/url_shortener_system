---
baseline_commit: 4ddddb7f
---

# Story 1.5: Đăng nhập và quản lý session

Status: done

## Story

Là một marketer đã xác minh email,
Tôi muốn đăng nhập, sử dụng authenticated workspace và đăng xuất,
Để tôi quản lý campaign links của mình an toàn.

## Requirements Traceability

- **FR-1, FR-3** — email/password sign-in, session lifecycle và protected workspace. Google OAuth/linking thuộc Stories 1.6–1.7.
- **NFR-4** — cookie session `HttpOnly`, `Secure` trong production, `SameSite=Lax`.
- **NFR-5** — Better Auth tiếp tục hash password; frontend không persist/log password.
- **NFR-6** — PostgreSQL-backed login limiter, generic credential error và anti-enumeration.
- **NFR-7 / AD-18** — mọi browser mutation cần exact `Origin` và `Sec-Fetch-Site: same-origin`.
- **AD-9** — Better Auth là owner duy nhất của user, session, cookie và verification state.
- **AD-10** — account/IP atomic fixed-window limiter, `429`, `Retry-After`, privacy-safe throttle telemetry.
- **AD-14 / AD-19** — Nest DTO → OpenAPI → generated contracts; generated diff, PostgreSQL integration và E2E là required evidence.
- **UX-DR3, UX-DR17, UX-DR18, UX-DR22** — native auth controls, keyboard/focus, error semantics và reflow 320px.

## Acceptance Criteria

1. **Verified email/password sign-in**
   **Given** marketer có account email/password đã xác minh
   **When** họ gửi credentials đúng tới `POST /api/authentication/sign-in`
   **Then** Better Auth tạo canonical session và facade forward toàn bộ `Set-Cookie` mà không trả token trong JSON
   **And** cookie là `HttpOnly`, `SameSite=Lax`, host-only; production chỉ chấp nhận `PUBLIC_ORIGIN` HTTPS để Better Auth phát cookie `Secure`
   **And** UI chỉ redirect tới `/dashboard`, `/links` hoặc `/account` local đã allowlist; fallback là `/dashboard`
   **And** `/api/me` resolve canonical string `ActorId` cho protected request.

2. **Invalid credential và unverified account không tạo session**
   **Given** email không tồn tại hoặc password sai
   **When** marketer submit Sign in
   **Then** facade trả cùng `401 INVALID_CREDENTIALS`, không `Set-Cookie`, không tiết lộ existence
   **And** form giữ normalized email, không trả/persist/log password và xóa password khỏi DOM sau non-validation server result.

   **Given** account chưa xác minh
   **When** marketer cố đăng nhập
   **Then** facade trả `403 EMAIL_VERIFICATION_REQUIRED`, không tạo session
   **And** UI hiển thị guidance xác minh và action tới resend flow hiện có, chịu verification cooldown.

3. **Atomic account/IP throttle**
   **Given** browser gửi sign-in hợp lệ về shape
   **When** limiter admission chạy
   **Then** PostgreSQL atomically áp dụng account `5 attempts / 15 phút` theo HMAC(normalized email) và IP `30 attempts / 15 phút` theo HMAC(socket IP)
   **And** hai scope được consume trong cùng transaction; nếu một scope bị reject, mọi provisional increment bị rollback
   **And** `429 LOGIN_THROTTLED` có integer `Retry-After` tính theo DB clock lớn nhất giữa các scope bị reject
   **And** Better Auth không được gọi, không tạo session; structured `login_throttle_total` chỉ có `scope=account|ip`, không PII/digest.

4. **Generated facade và raw lifecycle boundary**
   **Given** browser cần sign-in hoặc sign-out
   **When** web action gọi API
   **Then** chỉ dùng `createApiClient()` generated contract với same-origin credentials, exact `Origin` và `Sec-Fetch-Site`
   **And** raw `/api/auth/sign-in/email`, `/api/auth/sign-out`, `/api/auth/get-session` trả `404` trước Better Auth handler
   **And** OAuth callback paths tương lai không bị chặn.

5. **Protected session boundary và expiry**
   **Given** marketer truy cập Dashboard, Links hoặc Account
   **When** protected request được xử lý
   **Then** `SessionGuard` gọi Better Auth `getSession` đúng một lần, forward mọi session refresh/expiry `Set-Cookie`, rồi gắn immutable `ActorId`
   **And** invalid, expired hoặc dependency-failed session fail closed bằng `401` RFC 9457 với `Cache-Control: no-store`
   **And** loader redirect `/sign-in?redirectTo=...` giữ pathname + query; không lưu password/auth secret và chưa có unsaved protected form state để restore.

6. **Server-confirmed sign-out**
   **Given** marketer chọn Sign out tại Account
   **When** request đến `POST /api/authentication/sign-out`
   **Then** facade resolve canonical session, gọi Better Auth `revokeSession` trước `signOut`, rồi forward cookie-clear headers
   **And** UI chỉ redirect `/sign-in` khi server xác nhận success; protected route không còn truy cập được
   **And** nếu revoke/session dependency thất bại, response là generic `503`, cookie không bị xóa và UI giữ authenticated state với recoverable error
   **And** Sign in nêu rõ password reset chưa thuộc MVP, không có dead link.

7. **Accessible auth và authenticated navigation**
   **Given** marketer dùng keyboard, screen reader hoặc viewport 320px
   **When** sign-in, sign-out hoặc protected navigation thay đổi state
   **Then** controls là native, có label/autocomplete/reveal semantics/loading duplicate protection
   **And** blocking error dùng `role="alert"`; skip link, title, route announcer, main focus, one-active-nav, drawer Escape/focus-return và reflow giữ hoạt động.

## Scope Boundary and Locked Decisions

- **Trong scope:** PostgreSQL login limiter; Nest sign-in/sign-out facade; Better Auth cookie/session forwarding; raw lifecycle denylist; generated contracts; sign-in/safe redirect/logout UI; session loader; tests, migration, Docker and artifact evidence.
- **Ngoài scope:** Google OAuth/linking (1.6/1.7), password reset, remember-me UI, cookie cache, TTL/renewal custom policy, Redis/external limiter, session/token store thứ hai, trusted-proxy/X-Forwarded-For policy, metrics backend/scraper.
- **One auth owner:** Better Auth tự tạo, ký, refresh và xóa cookie/session. Facade chỉ forward nguyên mảng `Set-Cookie`; không parse, join, ký hay tự xóa cookie.
- **Cookie security:** không override Better Auth cookie defaults. `PUBLIC_ORIGIN` HTTPS là bắt buộc khi `NODE_ENV=production`; local Docker giữ HTTP và `NODE_ENV=development`.
- **Login policy:** account 5/900 giây, socket IP 30/900 giây; không tin `X-Forwarded-For`; HMAC SHA-256 domain-separated `login-rate-limit:v1:{scope}:{value}`; DB không lưu raw email/IP/password.
- **Limiter behavior:** fixed window dùng PostgreSQL DB clock; single transaction dùng một checked-out `pg.Client`; reject bất kỳ scope nào rollback toàn bộ admission; retry seconds luôn >= 1.
- **Public errors:** invalid Better Auth credentials map một `401 INVALID_CREDENTIALS`; `EMAIL_NOT_VERIFIED` map `403 EMAIL_VERIFICATION_REQUIRED`; throttle map `429 LOGIN_THROTTLED`; unknown Better Auth/DB failure map generic `503 AUTHENTICATION_UNAVAILABLE`.
- **Logout invariant:** Better Auth native `signOut` nuốt lỗi delete session; vì vậy facade bắt buộc `getSession → revokeSession → signOut`. Revoke failure là failure, không điều hướng UI.
- **Safe redirect:** chỉ exact `/dashboard`, `/links`, `/account`, giữ query và bỏ fragment. Reject missing/external/protocol-relative/backslash/encoded slash/double-encoded separator/public routes/noncanonical path; fallback `/dashboard`.
- **Verification replay:** valid verification token replay trong TTL là idempotent no-op success; không session, delivery hoặc side effect mới. Không tạo verification token store song song.
- **Telemetry:** `login_throttle_total` hiện là structured sanitized log event với scope. Không khẳng định Prometheus/OTel scrape/alert trước khi có collector được chốt.

## Tasks / Subtasks

- [x] Task 1: PostgreSQL atomic login limiter (AC: 3)
  - [x] 1.1 Tạo application port/use case và HMAC key helper không phụ thuộc Nest/Drizzle.
  - [x] 1.2 Tạo `login_rate_limit` schema/migration forward-only: scope, digest, DB-clock window, attempts và timestamps; không PII/FK/cleanup job.
  - [x] 1.3 Implement raw-`pg` repository transaction cho account/IP admission, rollback, retry seconds và idempotent pool close.
  - [x] 1.4 Thêm unit và real PostgreSQL concurrency/window-reset/rollback/migration tests.

- [x] Task 2: Authentication facade và session boundary (AC: 1–6)
  - [x] 2.1 Thêm DTO, controller, RFC 9457 filter/service cho `POST /api/authentication/sign-in` và `sign-out`, `no-store`, operation IDs, generated OpenAPI.
  - [x] 2.2 Delegate Better Auth in-process với `returnHeaders:true`; forward mảng `getSetCookie()`, không expose Better Auth token JSON.
  - [x] 2.3 Wire limiter provider/lifecycle, error mapping và privacy-safe throttle event.
  - [x] 2.4 Mở rộng raw auth lifecycle denylist cho sign-in/sign-out/get-session; giữ Bootstrap order origin check → denylist → official handler → parsers.
  - [x] 2.5 `SessionGuard` resolve một lần, immutable Actor context, forward refresh/expiry cookies; production HTTP origin fail-fast.
  - [x] 2.6 Implement authoritative sign-out revoke sequence và generic failure path.

- [x] Task 3: Web sign-in/session/logout UX (AC: 1, 2, 4–7)
  - [x] 3.1 Thêm generated-client React Router actions, local safe redirect parser, generic/unverified/throttled/unavailable states.
  - [x] 3.2 Thay sign-in placeholder bằng native accessible form, `current-password`, password reveal, submit protection và server-result password clearing.
  - [x] 3.3 Đặt logout server-confirmed tại Account; lỗi giữ protected UI, không optimistic clear state.
  - [x] 3.4 Giữ loader fail-closed/deep-link query behavior, existing AppShell keyboard/drawer contracts và responsive auth shell.

- [x] Task 4: Evidence, generated artifacts và review (AC: 1–7)
  - [x] 4.1 Regenerate OpenAPI/types; cập nhật architecture negative fixture cấm raw browser lifecycle calls.
  - [x] 4.2 Thêm unit, real PostgreSQL auth/limiter/session integration và browser E2E flows.
  - [x] 4.3 Chạy typecheck, unit/integration, Playwright, Docker migration/app health; xử lý review findings.
  - [x] 4.4 Docs impact: **minor** — README thêm authentication facade endpoints; không có architecture/roadmap change vì invariant đã tồn tại.

## Review Findings

- [x] [High][Patch] Production `PUBLIC_ORIGIN=http://...` có thể làm Better Auth phát cookie không Secure. `config.ts` giờ reject non-HTTPS effective origin khi `NODE_ENV=production`; config test phủ regression.
- [x] [High][Patch] `/api/me` bỏ qua Better Auth refresh/expiry cookie. `SessionGuard` giờ dùng `returnHeaders:true`, forward toàn bộ `getSetCookie()` và unit test phủ multiple/clearing cookies.
- [x] [High][Patch] Better Auth `signOut` nuốt failure xóa DB session nhưng vẫn xóa browser cookie. Facade giờ revoke canonical token trước `signOut`; revoke failure trả `503`, không gọi cookie-clear; service test phủ failure.
- [x] [Medium][Patch] Safe redirect cần từ chối encoded slash/backslash và external form. Parser dùng strict protected-path allowlist, same-origin parse, query preservation và table-driven tests.
- [x] [Medium][Patch] API process boundary 2-second polling không đủ cho cold start sau module additions. Test dùng 5-second polling/15-second test deadline, giữ sentinel/no-secret assertions.
- [x] [Review][Patch] Cấu hình exact trusted proxy chain cho Render và derive client IP từ forwarding chain đã xác thực; không dùng shared proxy peer hoặc client-supplied forwarding header [apps/api/src/auth/authentication.service.ts:43]
- [x] [Review][Patch] Chỉ map `INVALID_EMAIL_OR_PASSWORD` thành `401`; Better Auth API errors khác phải thành generic `503` [apps/api/src/auth/authentication.service.ts:77]
- [x] [Review][Patch] Sign-in phải nhận password non-empty tối đa 128 ký tự để mọi wrong password đi qua generic credential path [apps/api/src/auth/authentication.dto.ts:13]
- [x] [Review][Patch] Tắt Better Auth built-in production rate limiter; PostgreSQL limiter là policy owner duy nhất [apps/api/src/auth/better-auth-instance.ts:24]
- [x] [Review][Patch] Không dùng shared `"unknown"` IP bucket khi socket address thiếu; fail closed thành dependency error [apps/api/src/auth/authentication.service.ts:43]
- [x] [Review][Patch] Chuẩn hóa trailing slash trước raw lifecycle denylist để boundary luôn chạy trước Better Auth [apps/api/src/auth/auth-lifecycle-deny.middleware.ts:25]
- [x] [Review][Patch] Sắp xếp limiter scopes theo canonical lock order trước transaction để repository không deadlock với caller đảo thứ tự [packages/db/src/login-rate-limit-repository.ts:36]
- [x] [Review][Patch] Shutdown phải await hoặc xử lý hoàn tất limiter pool close; không để close tiếp tục ngoài lifecycle sau timeout race [apps/api/src/auth/login-rate-limit-lifecycle.provider.ts:12]
- [x] [Review][Patch] `/api/me` 401 phải có RFC 9457 `instance` và generated `application/problem+json` contract [apps/api/src/auth/session.guard.ts:23]
- [x] [Review][Patch] Tách sign-in/sign-out success DTO để generated client không chấp nhận trạng thái bất khả thi [apps/api/src/auth/authentication.dto.ts:19]
- [x] [Review][Patch] Bổ sung real HTTP/PostgreSQL evidence cho invalid credentials, throttle, CSRF no-side-effect và cookie/session success boundaries; unit tests phủ auth outage và revoke/session dependency failure [apps/api/src/registration/registration.integration.test.ts:236]
- [x] [Review][Patch] Ngăn failed sign-out revalidate protected session loader; giữ Account khi auth dependency đang lỗi [apps/web/src/router.tsx:24]
- [x] [Review][Patch] Đồng bộ Web sign-in password `1–128`, normalized email DOM và generated-client request protocol [apps/web/src/routes/authentication-actions.ts:49]
- [x] [Review][Patch] Reject literal/encoded dot-segment redirect thay vì chấp nhận URL canonicalization [apps/web/src/routes/authentication-actions.ts:30]
- [x] [Review][Patch] Focus main landmark sau protected navigation, không cướp focus ở initial load [apps/web/src/components/app-shell.tsx:42]
- [x] [Review][Patch] Khai báo `Cache-Control: no-store` trong OpenAPI auth success/error responses và regenerate contracts [apps/api/src/auth/authentication.controller.ts:55]
- [x] [Review][Patch] Đổi migration limiter sang monotonic `0005`, xác thực journal/snapshot chain và clean-generation gate [tests/verify-migrations.js:1]
- [x] [Review][Patch] Sửa unauthenticated `/api/me` README smoke thành expected `401`, không dùng `curl -f` [README.md:50]

## Dev Notes

### Previous Story Intelligence

- Story 1.3 thiết lập load-bearing bootstrap: ESM, `bodyParser:false`, origin check, official Better Auth handler trước parsers, generated contracts và `/api/me`. Không remount auth hoặc tạo session owner khác.
- Story 1.4 pin password `12–128`, `requireEmailVerification:true`, `autoSignIn:false`, signed-JWT verification idempotent replay, raw verification lifecycle denylist và generated-client browser mutations. Reuse toàn bộ boundary này.
- Better Auth `1.6.23` logger phải disabled vì default path có thể log raw email. Không log email/IP/password/cookie/token/digest/full query.
- Prior review lessons giữ nguyên: real PostgreSQL chứng minh transaction/concurrency; parser errors phải RFC 9457/no-store; generated artifacts không hand-edit; `Set-Cookie` arrays không join vì `Expires` có dấu phẩy.

### Better Auth 1.6.23 Facts

- In-process sign-in: `auth.api.signInEmail({ body: { email, password, rememberMe:false }, headers, returnHeaders:true })`.
- In-process session: `auth.api.getSession({ headers, returnHeaders:true })`; refresh/expired path có thể phát cookie headers phải forward.
- In-process authoritative revoke: `auth.api.revokeSession({ body:{ token }, headers })`; chỉ sau đó gọi `auth.api.signOut({ headers, returnHeaders:true })` để clear browser cookies.
- Default cookie attributes là `HttpOnly`, `SameSite=Lax`, host-only; Better Auth derives Secure từ HTTPS base URL. Không bật `useSecureCookies:true` toàn môi trường vì local HTTP Docker sẽ mất session.

### Security and Privacy Guardrails

- Không persist/log raw email, socket IP, password, token, cookie, HMAC digest hoặc full query string.
- Không trả Better Auth `token`/user payload qua facade response. Success chỉ trả allowlisted status.
- Không tự tin client-supplied `X-Forwarded-For`; trusted-proxy policy là work deploy sau.
- Không thêm Redis, memory limiter, Better Auth built-in limiter hoặc second session/token store.
- Browser không gọi raw `/api/auth/*` lifecycle routes. Generated client + origin protocol là browser contract duy nhất.
- Không auto-submit sau `Retry-After`; browser countdown/copy chỉ là presentation, DB clock là authority.

### Existing Files to Update and Preserve

- `apps/api/src/bootstrap.ts`: middleware order không được đổi.
- `apps/api/src/auth/better-auth-instance.ts`: giữ Better Auth composition root và verification configuration Story 1.4.
- `apps/api/src/auth/session.guard.ts`: one resolve/request, immutable ActorId, no-store fail-closed problem response.
- `apps/web/src/routes/session-loader.ts`: giữ pathname + query khi fail closed.
- `apps/web/src/routes/auth-page.tsx`, `ErrorSummary`, `PrimaryButton`, `RouteAnnouncer`, AppShell: reuse semantic/accessibility behavior; không tạo auth component duplicate.
- `packages/contracts/openapi.json` và `src/generated/api-types.ts`: chỉ cập nhật bằng generator.

### Testing Requirements and Evidence Limits

- Real PostgreSQL required cho migration, atomic dual-scope limiter, verified/unverified session lifecycle, revoke invalidation và raw denylist.
- Browser E2E dùng intercepted facade/session responses vì shell server cố ý có DB unreachable; nó chứng minh UI/routing, không thay thế cookie/session API integration.
- HTTP/PostgreSQL integration phủ short/long invalid credentials, account throttle, integer `Retry-After`, CSRF no-side-effect, unauthenticated RFC 9457 và cookie/session lifecycle.
- Direct current gap retained for future hardening: production HTTPS integration chưa assertion riêng `Secure; SameSite=Lax`; telemetry mới là structured sanitized event, chưa có collector sink.

### Project Structure Notes

- Application port/use case: `packages/application/src/login-rate-limit.ts`.
- PostgreSQL schema/repository/migration: `packages/db/src/schema/login-rate-limit-schema.ts`, `packages/db/src/login-rate-limit-repository.ts`, `packages/db/migrations/`.
- Nest facade/session lifecycle: `apps/api/src/auth/`.
- Router actions/pages: `apps/web/src/routes/`.
- File names kebab-case; runtime code under 200 lines when practical; no new dependencies.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.5`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-url_shortener_system-2026-07-19/prd.md#FR-1`, `#FR-3`, `#NFR-4`, `#NFR-6`, `#NFR-7`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md#AD-9`, `#AD-10`, `#AD-14`, `#AD-18`, `#AD-19`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md#State Patterns`, `#Accessibility Floor`]
- [Source: `_bmad-output/project-context.md#Framework-Specific Rules`, `#Testing Rules`, `#Development Workflow Rules`]
- [Source: `_bmad-output/implementation-artifacts/1-3-tich-hop-better-auth-va-generated-api-contracts.md`]
- [Source: `_bmad-output/implementation-artifacts/1-4-dang-ky-va-xac-minh-email.md`]
- [Source: `https://better-auth.com/docs/authentication/email-password`]
- [Source: `https://better-auth.com/docs/concepts/cookies`]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code)

### Debug Log References

- Better Auth exact `1.6.23` package source verified `signInEmail`/`signOut`/`getSession` return-header behavior; `Set-Cookie` forwarded as string array, never joined.
- Local Node was `22.21.1`, below project pin `>=22.22.0`; normal `npm ci --dry-run` correctly rejected engine. Local validation used explicit `npm_config_engine_strict=false`; Docker image/CI pin Node `22.22.0`.
- Playwright Chromium was absent on first local run; installed browser then E2E passed. This local Windows 10 run is supplemental; CI/Linux remains acceptance platform.
- Docker local port `5432` unavailable; `.env` uses ignored `POSTGRES_PORT=5433`. Compose app requires `NODE_ENV=development` for local HTTP public origin; production rejects HTTP by design.
- Generated OpenAPI/types được tái sinh bằng `npm run generate:contracts`; `verify:contracts` là clean-generation gate và phải chạy xanh trước khi Story chuyển `done`.

### Completion Notes List

- Added atomic PostgreSQL dual-scope login limiter, HMAC key utility, Drizzle schema/migration and lifecycle-safe pool cleanup.
- Added generated Nest authentication facade with non-enumerating credentials, unverified, throttled and dependency error mappings; raw lifecycle routes remain unavailable to browser.
- Added authenticated cookie/session forwarding, immutable Actor context, production HTTPS origin guard and server-confirmed logout revocation.
- Added generated contracts, accessible sign-in flow, allowlisted redirect, Account logout and password non-persistence.
- Added regression coverage for limiter concurrency/rollback, facade/session lifecycle, raw boundary, safe redirect, password clearing, logout success/failure and reflow.
- Docs impact: minor README endpoint/runbook update. No new architecture decision or product roadmap update needed.

### Validation

Executed against the uncommitted Story 1.5 checkout on 2026-08-12:

- `INTEGRATION_DATABASE_URL=... npm run check`: **42 files, 210 tests passed** with local PostgreSQL Docker; toolchain, typecheck, architecture, build, generated contracts and migration consistency gates passed.
- `npm run test:e2e`: **29 passed**.
- Adversarial code-review rerun: no verified actionable correctness/security defects in scoped auth, Web, limiter and migration gate changes.
- Docker Compose: PostgreSQL and app healthy; migration service exited `0`; repeated migration generation found no schema drift.
- Windows Playwright remains supplemental; CI/Linux is the browser acceptance environment.

### File List

- NEW: `_bmad-output/implementation-artifacts/1-5-dang-nhap-va-quan-ly-session.md`
- NEW: `packages/application/src/{login-rate-limit.ts,login-rate-limit.test.ts}`
- NEW: `packages/db/src/{login-rate-limit-repository.ts,login-rate-limit-repository.integration.test.ts,schema/login-rate-limit-schema.ts}`
- NEW: `packages/db/migrations/{0005_talented_gorilla_man.sql,meta/0005_snapshot.json}`
- NEW: `apps/api/src/auth/{authentication.controller.ts,authentication.dto.ts,authentication.service.ts,authentication.service.test.ts,authentication-problem.filter.ts,login-rate-limit-lifecycle.provider.ts,session.guard.test.ts}`
- NEW: `apps/web/src/routes/{authentication-actions.ts,authentication-actions.test.ts}`
- NEW: `tests/{verify-migrations.js,e2e/authentication-flow.spec.ts}`
- UPDATE: `README.md`, `compose.yaml`, `_bmad-output/{planning-artifacts/epics.md,implementation-artifacts/sprint-status.yaml}`
- UPDATE: `packages/application/src/index.ts`, `packages/db/{drizzle.config.ts,src/index.ts,src/migrations.integration.test.ts,migrations/meta/_journal.json}`
- UPDATE: `apps/api/src/{app.module.ts,config.ts,config.test.ts,tokens.ts,registration/registration-parser-error.middleware.ts,registration/registration.integration.test.ts}`
- UPDATE: `apps/api/src/auth/{auth-lifecycle-deny.middleware.ts,auth-lifecycle-deny.middleware.test.ts,better-auth.integration.test.ts,session.guard.ts}`
- UPDATE: `packages/contracts/{openapi.json,src/generated/api-types.ts}`
- UPDATE: `apps/web/src/{router.tsx,routes/auth-page.tsx,routes/auth-page.test.tsx,routes/account-page.tsx}`
- UPDATE: `tests/{api-process.test.ts,architecture-boundaries.test.js,e2e/auth-shell.spec.ts,e2e/shell-smoke.spec.ts}`, `playwright.config.ts`

## Change Log

- 2026-08-11: Rebuilt Story 1.5 artifact to match Story 1.3–1.4 traceability, BDD criteria, implementation record, review provenance and validation evidence after implementation.
- 2026-08-12: Applied all adversarial review patches, added generated contract/migration gates, passed full PostgreSQL and browser validation, and marked Story done.

## Unresolved Questions

- `login_throttle_total` is a structured sanitized event, not a configured scrape/alert metric. Add a collector contract only when operations selects Prometheus/OTel or equivalent.
- Add explicit production-HTTPS `Secure; SameSite=Lax` cookie integration assertion when CI provides a trusted TLS termination test boundary.
