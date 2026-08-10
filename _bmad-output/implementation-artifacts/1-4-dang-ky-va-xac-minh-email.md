---
baseline_commit: 4b5a3f2fef5f31f7f22aa84d14bd3a9a384d5fb7
---

# Story 1.4: Đăng ký và xác minh email

Status: done

## Story

Là một marketer,
Tôi muốn đăng ký bằng email/password và xác minh email,
Để tôi có thể kích hoạt tài khoản an toàn.

## Requirements Traceability

- **FR-1** — tạo tài khoản email/password; email phải được xác minh trước khi account hoạt động.
- **NFR-5** — Better Auth hash password; không plaintext hoặc reversible encryption.
- **NFR-7 / AD-18** — mọi mutation browser dùng exact `Origin` + `Sec-Fetch-Site: same-origin`; thiếu/sai trả `403`.
- **AD-9** — Better Auth tiếp tục là user/token/session owner duy nhất; raw signup/send-verification/verify routes không được bypass facade qua public network.
- **AD-10 / AD-11** — resend cooldown atomic trong PostgreSQL, `429` + chuẩn `Retry-After`, bounded delivery retry và secret-free logs.
- **AD-14** — Nest DTO → OpenAPI → generated client; React Router Data Mode gọi generated facade, không gọi untyped `/api/auth/*` trực tiếp.
- **AD-15 / AD-17 / AD-19** — provider call ngoài auth transaction, worker restart/lease recovery độc lập, migration + integration gates tái lập trong CI.
- **UX-DR3/4/17/18/20/22** — accessible signup/verification states, 44px controls, 16px inputs, focused error summary, 320px reflow.

## Acceptance Criteria

1. **Accessible sign-up form**
   **Given** marketer chưa đăng nhập
   **When** họ mở Sign up
   **Then** form hiển thị label rõ cho email và password
   **And** hỗ trợ `autocomplete`, paste, password manager và nút hiện/ẩn password có accessible name/state
   **And** input có chiều cao tối thiểu 44px và font size ít nhất 16px.

2. **Unverified account + non-enumerating response**
   **Given** marketer nhập email hợp lệ và password đạt security policy
   **When** họ submit form
   **Then** Better Auth tạo account ở trạng thái chưa xác minh
   **And** password được hash bằng Better Auth `1.6.23`
   **And** verification delivery được handoff bền vững để provider chạy ngoài auth DB transaction
   **And** public response không tiết lộ account đã tồn tại hay chưa.

3. **Verification pending, no auto-login**
   **Given** delivery được enqueue hoặc account đã tồn tại
   **When** Sign up hoàn tất
   **Then** UI hiển thị verification-pending state với hướng dẫn kiểm tra inbox
   **And** có `Resend email` theo cooldown và `Back to sign in`
   **And** account chưa xác minh không nhận session cookie và `/api/me` vẫn trả `401`.

4. **Provider failure is recoverable**
   **Given** email provider tạm thời thất bại
   **When** worker không gửi được verification email
   **Then** account vẫn chưa xác minh và delivery retry có giới hạn
   **And** pending UI cung cấp generic recovery/resend guidance
   **And** logs không chứa raw email, verification URL/token, password, cookie hoặc provider secret.

5. **Valid verification**
   **Given** marketer dùng verification token hợp lệ
   **When** generated client POST token tới verification facade
   **Then** Better Auth đánh dấu email verified
   **And** UI hiển thị verified-success với action `Sign in`
   **And** không tạo session tự động
   **And** replay chỉ là idempotent success, không tạo mutation, delivery hoặc session thứ hai
   **And** Better Auth tiếp tục sở hữu token validation; không thêm token store song song.

6. **Invalid/expired verification**
   **Given** token hết hạn, malformed hoặc invalid
   **When** verification facade xử lý token
   **Then** UI giải thích link invalid/expired, có resend action
   **And** response không tiết lộ account data hoặc lý do chi tiết có thể dùng để enumeration.

7. **Resend cooldown**
   **Given** marketer resend liên tục
   **When** request nằm trong cooldown PostgreSQL atomic
   **Then** API trả `429` với `Retry-After` theo giây
   **And** không enqueue/gửi thêm email
   **And** UI disable resend và hiển thị countdown theo header, không dựa vào client clock làm authority.

8. **Accessible validation**
   **Given** form có lỗi
   **When** marketer submit
   **Then** submit vẫn kích hoạt validation; `ErrorSummary` nhận focus và link tới field lỗi
   **And** field dùng `aria-invalid` + `aria-describedby`; blocking error dùng `role="alert"`
   **And** email được giữ lại, password không được log hoặc persist ngoài form memory.

9. **Loading, timeout, duplicate submit**
   **Given** request đang xử lý hoặc gặp timeout/network error
   **When** marketer submit lại
   **Then** `PrimaryButton` loading chặn duplicate submit
   **And** retry giữ email/password trong form memory an toàn
   **And** DB unique email + generic facade bảo đảm không tạo nhiều account cho cùng email.

## Scope Boundary and Locked Decisions

- **Trong scope:** signup + resend + verify Nest facades; Better Auth verification config; PostgreSQL delivery outbox + resend cooldown; Resend adapter bằng native `fetch`; worker delivery loop; signup/pending/invalid/success UI; migrations/contracts/tests/config/Docker runbook updates.
- **Ngoài scope:** sign-in/session UX (1.5), password reset, Google OAuth/linking (1.6/1.7), profile name, roles/admin, click queue, mail analytics/webhooks, HTML design system cho marketing email.
- **Provider:** Resend REST API, native Node `fetch`; không thêm SDK/dependency. Mỗi delivery row là một logical send; `Idempotency-Key` = opaque delivery ID, giữ nguyên qua mọi retry của row; provider giữ key 24h.
- **Password policy:** 12–128 ký tự, cho paste/password manager, không composition rule. Cấu hình cả Better Auth và UI/server validation; server là authority.
- **Required Better Auth `name`:** facade truyền constant `"Marketer"`; không dùng email làm display name hoặc thêm name field ngoài AC.
- **Verification TTL:** pin `expiresIn: 3600` giây. UI chỉ nói expired/invalid, không lộ timestamp/account state.
- **Resend cooldown:** 60 giây theo normalized-email keyed digest; PostgreSQL atomic. Better Auth built-in `X-Retry-After`/memory/IP limit không thay thế contract `Retry-After` này.
- **Replay semantics / source gap:** Better Auth 1.6.23 dùng signed JWT email-verification token và không lưu/consume nó trong `verification` table. Facade không tạo token store song song; valid first use chuyển `emailVerified:false→true`, replay thấy account đã verified nên là no-op success, không mutation/session/delivery thứ hai. Epic wording “token không thể dùng lại” yêu cầu strict rejection nhưng AD-9 cấm second token store; story áp dụng idempotent side-effect semantics và phải đưa mismatch này vào unresolved questions trước implementation.
- **Public API:** browser chỉ được gọi `/api/registration/sign-up`, `/api/registration/resend-verification`, `/api/registration/verify-email`. Giữ official handler cho lifecycle khác, nhưng chặn public network access tới raw `/api/auth/sign-up/email`, `/api/auth/send-verification-email`, `/api/auth/verify-email`; facade dùng `auth.api.*` in-process.
- **Delivery consistency:** Pin `sendOnSignUp:false`; facade `sign-up`/`resend` gọi Better Auth server API in-process, nhưng public response loại bỏ toàn bộ auth headers/body. Mọi request hợp lệ consume cùng atomic cooldown rồi gọi `auth.api.sendVerificationEmail` để giữ constant-time/non-enumerating behavior; Better Auth chỉ gọi callback cho eligible unverified account. Callback ghi outbox theo logical operation key và không gọi provider. Vì Better Auth nuốt callback error, facade read-after-write khi delivery được kỳ vọng; nếu không thể xác nhận handoff thì trả generic `503` theo cùng bounded timing envelope. Retry sau cooldown reconcile cùng unverified account, không tạo duplicate user/send.
- **Retry owner:** worker sở hữu toàn bộ 3-attempt budget (30s, 2m, 10m); provider adapter thực hiện đúng một bounded network attempt mỗi claim.
- **Layering:** application package sở hữu delivery/cooldown use cases và ports; `packages/db` implement repository; API/worker entrypoints chỉ điều phối use cases. Chỉ composition roots được import `packages/db` bằng architecture exception hẹp.

## Tasks / Subtasks

- [x] Task 1: Config + dependency-neutral email port (AC: 2, 4)
  - [x] 1.1 Tách config theo process: API chỉ validate delivery/outbox settings; worker mới đọc `EMAIL_DELIVERY_MODE=capture|resend`, `RESEND_API_KEY`, `EMAIL_FROM`. Khi `resend`, worker bắt buộc key/from; fail-fast không echo values. Production cấm `capture`; Compose/Render không truyền provider secret cho API.
  - [x] 1.2 Tạo framework-free delivery contracts trong `packages/application` (recipient, verification URL, opaque delivery ID; result/error category). Không import Better Auth/Resend.
  - [x] 1.3 Tạo Resend adapter bằng `fetch("https://api.resend.com/emails")`, timeout 5s, `Authorization`, `Idempotency-Key`, text email tối thiểu; một call = một network attempt, phân loại network/408/429/5xx là retryable; không log response body/secrets. Worker là retry owner duy nhất.
  - [x] 1.4 Tạo injected capture/failing adapters cho tests; không gửi external email trong CI.

- [x] Task 2: PostgreSQL delivery handoff + cooldown (AC: 2, 4, 5, 7, 9)
  - [x] 2.1 Thêm Drizzle tables tối thiểu: `verification_email_delivery` (opaque id, recipient, verification_url, logical_key, state `pending|leased|sent|dead`, attempts, available_at, lease_token, lease_until, sanitized error category, timestamps) và `verification_email_cooldown` (keyed HMAC/digest, next_allowed_at). Không FK delivery tới user vì callback có thể chạy trong auth transaction riêng.
  - [x] 2.2 Giữ existing Better Auth `verification` table/schema cho các lifecycle Better Auth khác; email-verification token 1.6.23 là signed JWT và được Better Auth validate. Không thêm verification-token table/digest riêng; outbox không dùng token làm logical key.
  - [x] 2.3 Sinh forward-only migration trong cùng chain; review snake_case/timestamptz/checks và indexes cho `(state, available_at, lease_until)`; update migration-from-empty assertions.
  - [x] 2.4 Implement application use cases + DB repositories cho atomic enqueue/idempotency/cooldown. Unique logical key ngăn concurrent duplicate delivery của cùng signup/resend operation; `INSERT ... ON CONFLICT` reconcile retry. Cooldown violation trả remaining whole seconds; không enqueue row.
  - [x] 2.5 Claim transaction dùng DB clock + `FOR UPDATE SKIP LOCKED`, cấp fresh `lease_token`/`lease_until`, increment attempts đúng một lần. Reclaim expired lease; complete/retry/dead update phải match `(id, state='leased', lease_token)` để stale worker không ghi đè.
  - [x] 2.6 Không log/query-string-print delivery URL/token; `sent` và `dead` phải xóa/redact `verification_url` + token material trong cùng guarded transition. Retry rows chỉ giữ tới bounded terminal window; ghi sanitized category only.

- [x] Task 3: Better Auth verification configuration (AC: 2, 3, 5, 6)
  - [x] 3.1 Trong `better-auth-instance.ts`, pin `minPasswordLength: 12`, `maxPasswordLength: 128`, `requireEmailVerification: true`, `autoSignIn: false`; `emailVerification.sendOnSignUp: false`, `expiresIn: 3600`, `autoSignInAfterVerification: false`; cấu hình logger allowlist/disabled để Better Auth `info` không log raw existing email.
  - [x] 3.2 `sendVerificationEmail({user,token})` không dùng Better Auth `url` native (`/api/auth/verify-email`). Callback enqueue outbox bằng logical operation key, dựng exact `{PUBLIC_ORIGIN}/verify-email?token=...`, rồi return; tuyệt đối không gọi provider/network hoặc tạo token store riêng. Capture test assert exact origin/path và cấm `/api/auth/verify-email` trong email.
  - [x] 3.3 Sau generic `auth.api.signUpEmail` path, signup facade consume atomic cooldown rồi luôn gọi explicit `auth.api.sendVerificationEmail`; Better Auth giữ constant-time behavior và chỉ callback cho eligible unverified account. Vì callback error bị nuốt, facade dùng operation-scoped marker/read-after-write để phân biệt “không cần delivery” với “delivery được kỳ vọng nhưng persist thất bại”; trường hợp sau map generic `503`. Retry/resend reconcile same unverified account bằng logical uniqueness; provider vẫn ngoài transaction.
  - [x] 3.4 Public handler chặn raw `/sign-up/email`, `/send-verification-email`, `/verify-email` bằng pre-handler path denylist; không dùng Better Auth `disabledPaths` vì facade cần same endpoints qua `auth.api.*` in-process. Giữ mount order origin check → denylist → `toNodeHandler` → parsers.
  - [x] 3.5 Không community wrapper, second user/token/session store hoặc auto-login workaround. Sửa Story 1.3 proof: signup `200` nhưng `token:null`, không cookie, `/api/me` 401; sau verify vẫn không cookie; explicit sign-in mới chứng minh canonical ActorId/session.

- [x] Task 4: Generated Nest registration facade (AC: 2, 3, 5, 6, 7, 9)
  - [x] 4.1 Thêm request/response DTOs với `class-validator`; bật validation đúng scope (không thay auth handler parser ordering). Mọi success/error dùng allowlisted DTO/RFC 9457 shape; không chứa user/id/email/existence/internal reason và không `Set-Cookie`; mọi response `Cache-Control: no-store`.
  - [x] 4.2 `POST /api/registration/sign-up`: normalize email, constant name `Marketer`, delegate `auth.api.signUpEmail`, map unique race/new/existing về cùng status/body; consume signup cooldown rồi gọi explicit Better Auth verification-send path, để Better Auth tự quyết eligible unverified account. Không tạo session. DB/provider-unavailable path trả generic `503`, không biến thành success giả.
  - [x] 4.3 `POST /api/registration/resend-verification`: atomic cooldown áp dụng cùng response/timing envelope cho absent/verified/unverified; mọi atomic winner gọi Better Auth send để giữ non-enumeration, Better Auth chỉ enqueue cho eligible unverified account. Throttle trả RFC 9457 problem `429` + integer `Retry-After`; cooldown/store failure fail closed generic `503`.
  - [x] 4.4 `POST /api/registration/verify-email`: validate token format rồi delegate token validation hoàn toàn cho `auth.api.verifyEmail`; map success/invalid/expired/replay về bounded DTOs. Không đọc/ghi token table trực tiếp từ facade; replay là idempotent no-op không side effect/session và phải được real PostgreSQL integration test chứng minh.
  - [x] 4.5 Annotate exact Swagger operation IDs và response/header schemas cho `200`, validation `400`, invalid/expired `400`, throttle `429`, dependency `503`; regenerate `openapi.json` + `api-types.ts`, không chỉnh tay.
  - [x] 4.6 Integration test raw network `/api/auth/sign-up/email`, `/api/auth/send-verification-email`, `/api/auth/verify-email` bị deny trước mutation; facade in-process calls vẫn hoạt động. Thêm architecture gate cấm raw auth lifecycle calls trong `apps/web`.

- [x] Task 5: Worker delivery loop (AC: 2, 4, 7)
  - [x] 5.1 Định nghĩa claim/complete/retry/dead use cases + repository ports trong `packages/application`; implement adapters trong `packages/db`. `apps/worker` composition root inject DB/provider rồi chỉ điều phối use cases, không direct table SQL trong worker loop.
  - [x] 5.2 Claim bounded batch bằng fenced protocol Task 2.5; ba provider calls tối đa tại lần đầu, sau 30s và sau thêm 2m. Backoff 10m là cửa sổ kế tiếp trong policy nhưng không được schedule vì call thứ tư vượt budget. Mọi retry dùng cùng Resend idempotency key; provider `429` tôn trọng bounded `Retry-After` nhưng không vượt retry window.
  - [x] 5.3 SIGTERM ngừng claim mới, hoàn tất/cancel in-flight trong deadline, guarded transition/release lease, đóng pool; logs allowlist delivery ID/category/attempt/correlation ID only.
  - [x] 5.4 Update architecture boundary: chỉ worker composition root được import `@url-shortener/db`, tương tự API adapter exception; negative fixture chứng minh worker modules khác vẫn bị cấm.
  - [x] 5.5 Update Docker Compose/runbook: worker có `DATABASE_URL`, delivery mode, sender và runtime provider secret; depends on successful migration, fail-fast config/schema, smoke enqueue→claim→graceful shutdown. Không thêm Redis/BullMQ/Mailpit.

- [x] Task 6: Sign-up form (AC: 1, 3, 8, 9)
  - [x] 6.1 Thay placeholder Sign up trong `auth-page.tsx` hoặc tách `sign-up-page.tsx`; giữ Sign in placeholder thuộc 1.5, page title/landmarks/skip link/route announcer.
  - [x] 6.2 Native email/password inputs: labels, `autocomplete="email"`/`"new-password"`, no paste blocking, 44px/16px, show/hide button với changing accessible name + `aria-pressed`.
  - [x] 6.3 Reuse `ErrorSummary` + `PrimaryButton`; field descriptions stable IDs; preserve email/password on network retry; clear password only after accepted completion.
  - [x] 6.4 React Router Data Mode action/fetcher gọi `createApiClient` generated facade với same-origin credentials + required Origin protocol; component event handler không raw `fetch`/Better Auth client. Accepted response chuyển pending state không phân biệt account.

- [x] Task 7: Verification states + resend (AC: 3, 5, 6, 7)
  - [x] 7.1 Thêm public `/verify-email` SPA route và reserved-route registry. Capture token from query, remove it from address bar/history, POST generated verification endpoint.
  - [x] 7.2 Render pending, verified success, invalid/expired, provider-delayed generic states. Actions: `Resend email`, `Back to sign in`, `Sign in`.
  - [x] 7.3 Resend state nhận email input khi không có pending form state; `429` countdown dùng `Retry-After`, accessible live status; không persist raw token/email ngoài component state.
  - [x] 7.4 Deep refresh `/verify-email?...` vẫn nhận SPA; API paths vẫn JSON/controller-owned.

- [x] Task 8: Real integration + UI gates (AC: 1–9)
  - [x] 8.1 PostgreSQL integration: new/existing signup same public response; one user; unverified; password hash != plaintext; no cookie; enqueue exactly once; CSRF matrix.
  - [x] 8.2 Provider capture/failure: callback/outbox handoff survives auth completion without network call; bounded retry/idempotency is exactly 3 total provider attempts, provider failure leaves unverified; sent/dead row token/URL redacted; logs/artifacts sentinel scan.
  - [x] 8.3 Verify valid/invalid/expired/replay; prove Better Auth signed-JWT behavior: first valid request flips `emailVerified`, replay is idempotent no-op with no session/delivery; explicit sign-in after verification restores Story 1.3 `/api/me` proof without moving Story 1.5 UX into scope.
  - [x] 8.4 Resend concurrent requests prove one atomic winner; loser `429` + integer `Retry-After`; no extra delivery; absent/verified/existing paths have same public status/body/timing envelope.
  - [x] 8.5 SSR/Vitest + Playwright: labels/autocomplete/reveal, focused summary/ARIA/alert, loading duplicate block, network retry, pending/cooldown/success/error states, generated-client-only mutation, keyboard, 320/375/800/1280 reflow, no 2D scroll.
  - [x] 8.6 Architecture/integration gates: raw lifecycle paths denied, worker boundary and lease fencing negative fixtures, callback failure/commit race/reclaim/stale lease tests, exact RFC 9457 response/header/cookie assertions.
  - [x] 8.7 Run typecheck/build/architecture, generated reproducibility, real PostgreSQL integration, `npm run test:e2e`, Docker build/migrate/app/worker enqueue→delivery smoke, `npm ci --ignore-scripts --dry-run`. `npm run check` clean-tree contract diff chỉ pass sau khi generated Story artifacts được commit; regeneration hash ổn định và tracked-artifact gate pass. Không skip/nới test.

### Review Findings

- [x] [Review][Patch] Verify dependency failures are mapped to generic `503`, not `400 INVALID_VERIFICATION` — `apps/api/src/registration/registration.service.ts:43-49`; the blanket catch collapses database/adapter failures and invalid tokens, and the verify operation lacks the required documented `503` response.
- [x] [Review][Patch] Confirm durable verification handoff after callback failure or ambiguous response — `apps/api/src/auth/better-auth-instance.ts:43-53`, `apps/api/src/registration/registration.service.ts:59-65`; Better Auth rethrows callback errors, making the marker check unreachable and skipping `hasDelivery(logicalKey)` reconciliation.
- [x] [Review][Patch] Do not burn signup cooldown before signup and handoff succeed — `apps/api/src/registration/registration.service.ts:28-33`; an auth, unique-race, or queue failure consumes 60 seconds although no delivery may exist, blocking recovery with `429`.
- [x] [Review][Patch] Reconcile concurrent first-signup unique races to the same generic accepted response — `apps/api/src/registration/registration.service.ts:31`, `apps/api/src/registration/registration.controller.ts:96-108`; bounded Better Auth retry and PostgreSQL integration evidence pass.
- [x] [Review][Patch] Route API mutations through application use cases — `apps/api/src/registration/registration.service.ts:52-55`, `apps/api/src/auth/better-auth-instance.ts:47`; API/auth directly invoke repository mutations despite existing `ConsumeVerificationEmailCooldown` and `EnqueueVerificationEmail` use cases and the locked layering rule.
- [x] [Review][Patch] Normalize malformed JSON/body-parser failures to RFC 9457 no-store responses — `apps/api/src/bootstrap.ts:38-39`, `apps/api/src/registration/registration-problem.filter.ts:10-16`; parser errors occur before the controller filter and currently return `application/json` with parser details.
- [x] [Review][Patch] Align email validation with Better Auth’s accepted grammar — `apps/api/src/registration/registration.dto.ts:5-7`; `class-validator` accepts addresses that Better Auth’s `z.email()` rejects, causing client input to become generic `503` instead of validation `400`.
- [x] [Review][Patch] Set RFC 9457 `instance` to the actual registration endpoint path — `apps/api/src/registration/registration.controller.ts:36-46`, `111-119`; all problem responses currently identify only `/api/registration` rather than the failed operation.

Review patch evidence: focused service/application/HTTP tests pass; full PostgreSQL Vitest `171/171`, typecheck, build, architecture, generated-contract regeneration, Playwright `26/26`, migration-from-empty/idempotence, app health and worker startup smoke all pass.

## Dev Notes

### Previous Story Intelligence (1.3 + review)

- Story 1.3 đã chứng minh official Better Auth handler + PostgreSQL schema + `/api/me` + generated contracts + AD-18. Reuse composition root; không remount auth.
- `better-auth.integration.test.ts` hiện kỳ vọng signup phát cookie; Story 1.4 phải đổi test theo verification-gated lifecycle, không giữ behavior cũ để làm test xanh.
- `SessionGuard` 401 phải tiếp tục `Cache-Control: no-store`, `application/problem+json`; provider/verification errors không đi qua guard.
- Generated contract gate phát hiện tracked/untracked drift; commit outputs, không hand-edit.
- Local Docker PostgreSQL dùng host port tùy `.env`, container luôn `postgres:5432`; migrations gate app. Worker hiện optional skeleton — Story 1.4 làm nó functional nhưng không thêm click queue.
- Toolchain exact pins: Node 22.22.0, npm 10.9.4, Better Auth 1.6.23, Nest 11.1.28, React/Router 19.2.7/8.2.0, Drizzle 0.45.2, PostgreSQL 18. Không upgrade.

### Existing Code to Update and Preserve

- `apps/api/src/auth/better-auth-instance.ts`: hiện chỉ `emailAndPassword.enabled`; thêm verification config nhưng giữ Drizzle adapter, baseURL/secret/trustedOrigins và canonical string ID.
- `apps/api/src/bootstrap.ts`: giữ load-bearing order và `bodyParser:false`.
- `apps/web/src/routes/auth-page.tsx`: placeholder chung; giữ Sign in boundary, focus-on-route-change, page title, skip link, landmark structure.
- `apps/web/src/router.tsx`: verification route phải public, không dùng protected session loader.
- `packages/application/src/reserved-routes.ts`: thêm `/verify-email`; giữ `/api` controller prefix.
- `ErrorSummary`, `PrimaryButton`, `.auth-shell`, `.auth-card`, `.focus-indicator`: reuse, không tạo auth-specific duplicates.
- `packages/contracts/src/index.ts`: giữ `credentials:"same-origin"`; web không dùng raw `fetch` hoặc Better Auth client.

### Security / Privacy Guardrails

- Không log raw IP, email, password, cookie, token, verification URL, provider API key/body hoặc full query string.
- Không đặt token/email vào analytics, localStorage/sessionStorage, URL logs hoặc error detail. Xóa query token bằng history replacement sau capture.
- HMAC/digest cooldown key dùng server secret/domain-separated input; không dùng unsalted plain hash để dò email offline.
- Outbox chứa sensitive verification URL tạm thời: DB-only, không expose API; redact/delete sau success; retention bounded.
- Provider API call không được giữ Better Auth transaction; callback chỉ enqueue DB handoff.
- Existing-account, absent-account, already-verified và provider-delay public copy/status không tạo enumeration oracle.
- Config secrets chỉ từ env; `capture` chỉ local/test, production fail-fast.

### Testing Requirements

- Real PostgreSQL cho transaction/migration/cooldown/concurrency; không mock DB.
- Injected capture/failing email transport; CI không gọi Resend.
- Assert sender call count, DB state, HTTP shape/header, cookie absence, token redaction và log sentinel — không chỉ snapshot UI.
- Playwright interaction evidence chạy CI/Linux; Windows 10 local không phải acceptance environment.
- Non-trivial worker loop có deterministic tests cho claim/retry/shutdown; không sleep dài/flaky timing.

### Project Structure Notes

- Application ports/types: `packages/application/src/`.
- Drizzle schema/repositories/migrations: `packages/db/src/` + `packages/db/migrations/`.
- Better Auth composition/facade/controllers: `apps/api/src/auth/` và `apps/api/src/registration/`.
- Provider adapter: `apps/worker/src/email/` (transport execution); API chỉ enqueue.
- UI/action: `apps/web/src/routes/`; shared primitives ở `apps/web/src/components/` chỉ khi semantics thực sự shared.
- Files <200 lines when logical split exists; kebab-case. Markdown/config exempt.

### Latest Technical Facts

- Better Auth 1.6.23 source: sign-up requires `name`; password default 8–128; `requireEmailVerification:true` + `autoSignIn:false` gives same `200` synthetic response for new/existing email. Story pins stricter 12–128 and constant name; default `info` logger includes raw existing email nên logger phải được khóa.
- `sendVerificationEmail` receives `{user,url,token}`. Native `url` points to `{baseURL}/api/auth/verify-email`, while product email must point to SPA `/verify-email`; compose from `PUBLIC_ORIGIN` + callback `token`. Story pins `sendOnSignUp:false` and explicit facade send so cooldown/handoff stay authoritative.
- Email-verification token là HS256 JWT (`email`, optional update fields, expiry); verify GET flips `emailVerified` and returns no-op success when already verified. Không có strict revocation store cho flow này; AC uses idempotent side-effect semantics, không thêm second token store.
- Better Auth `runInBackgroundOrAwait` catches/logs callback errors instead of propagating them; `auth.api.sendVerificationEmail` cũng đi qua helper này. Facade không thể dựa vào thrown callback error: repository callback phải ghi durable outcome theo logical operation key; facade đọc lại outcome và chỉ accept khi row tồn tại, nếu thiếu trả generic `503`.
- Better Auth built-in database rate limit requires `rateLimit` table and returns `X-Retry-After`, not required `Retry-After`; server `auth.api` calls bypass it. Use story-owned atomic cooldown facade, not memory limiter.
- Resend: `POST https://api.resend.com/emails`, Bearer auth, `Idempotency-Key` 1–256 chars; same key+payload suppresses duplicates for 24h; conflict responses are 409. Native fetch must check `response.ok`; worker, không adapter, sở hữu retry budget.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.4`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-url_shortener_system-2026-07-19/prd.md#Functional Requirements`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md#AD-9`, `#AD-10`, `#AD-11`, `#AD-14`, `#AD-15`, `#AD-18`, `#AD-19`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md#Authentication and verification`]
- [Source: `_bmad-output/project-context.md#Framework-Specific Rules`, `#Testing Rules`, `#Security`]
- [Source: `_bmad-output/implementation-artifacts/1-3-tich-hop-better-auth-va-generated-api-contracts.md#Review Findings`]
- [Source: `https://www.better-auth.com/docs/authentication/email-password`]
- [Source: `https://www.better-auth.com/docs/concepts/email`]
- [Source: `https://www.better-auth.com/docs/concepts/rate-limit`]
- [Source: `https://resend.com/docs/api-reference/emails/send-email`]
- [Source: `https://resend.com/docs/dashboard/emails/idempotency-keys`]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code)

### Debug Log References

- Task 1 RED: build thất bại do chưa có worker config/application delivery contracts/Resend adapter.
- Task 1 GREEN: `npm test -- --run apps/api/src/config.test.ts apps/worker/src/config.test.ts packages/application/src/verification-email-delivery.test.ts apps/worker/src/email/resend-verification-email-transport.test.ts` — 24/24 pass.
- Task 2 RED: application queue/repository modules chưa tồn tại; PostgreSQL migration assertions chưa có hai bảng.
- Task 2 GREEN: targeted unit 3/3 pass; real PostgreSQL migration/cooldown/idempotency/parallel claim/reclaim/fencing/redaction integration 4/4 pass.
- Task 3 RED: thiếu verification config, SPA URL helper và raw lifecycle deny middleware.
- Task 3 GREEN: real PostgreSQL Better Auth/config/handoff/raw-route integration 13/13 pass; signup in-process trả `token:null`, không session, outbox chứa SPA URL.
- Task 4 RED: facade ban đầu 404; sau wiring trả 201 và validation dùng `application/json` thay vì RFC 9457.
- Task 4 GREEN: API build, generated OpenAPI/client, architecture negative fixture và real PostgreSQL registration/auth integration 14/14 pass.
- Task 5 GREEN: worker loop deterministic tests cover sent/retry/dead/attempt exhaustion/abort; Docker capture enqueue→sent + SIGTERM exits 0, terminal payload redacted.
- Task 6–7 GREEN: generated-client actions, signup/verification/resend UI, focused validation summary, password kept only in form memory, token query removed và no-referrer policy.
- Task 8 GREEN: PostgreSQL 34 files/162 tests; Playwright 26/26; typecheck/build/architecture pass; Docker build/migrate/app/worker smoke pass; pinned Node 22.22.0/npm 10.9.4 dry-run installs 500 packages; generated hashes stable.
- Review fixes: block provider calls after attempt budget, remove password from action data, add pending/resend signup state, disable native validation in favor of accessible summary, prevent StrictMode duplicate verification.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- Task 1: tách worker-only provider config; thêm framework-free delivery contracts, capture/failing transports và native-fetch Resend single-attempt adapter với timeout/classification/redaction tests.
- Tasks 2–4: thêm PostgreSQL cooldown/outbox/fenced lease, Better Auth verification handoff, raw lifecycle denylist và RFC 9457 registration facade với generated contracts.
- Tasks 5–7: worker delivery retry owner duy nhất; signup/verification/resend React Router flows dùng generated client; token/password không persist ngoài memory cần thiết.
- Task 8: full integration/UI/Docker/toolchain gates pass; Story chuyển `review`.

### Change Log

- 2026-08-09: Implement Story 1.4 registration, email verification, resend cooldown, outbox worker, generated contracts, accessible UI và regression gates.

### File List

- `_bmad-output/implementation-artifacts/1-4-dang-ky-va-xac-minh-email.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/api/src/config.test.ts`
- `apps/worker/src/config.test.ts`
- `apps/worker/src/config.ts`
- `apps/worker/src/email/resend-verification-email-transport.test.ts`
- `apps/worker/src/email/resend-verification-email-transport.ts`
- `apps/worker/src/main.ts`
- `packages/application/src/index.ts`
- `packages/application/src/verification-email-delivery.test.ts`
- `packages/application/src/verification-email-delivery.ts`
- `packages/application/src/verification-email-queue.test.ts`
- `packages/application/src/verification-email-queue.ts`
- `packages/db/drizzle.config.ts`
- `packages/db/migrations/0001_cloudy_fantastic_four.sql`
- `packages/db/migrations/meta/0001_snapshot.json`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/src/index.ts`
- `packages/db/src/migrations.integration.test.ts`
- `packages/db/src/schema/verification-email-schema.ts`
- `packages/db/src/verification-email-repository.integration.test.ts`
- `packages/db/src/verification-email-repository.ts`
- `apps/api/src/auth/auth-lifecycle-deny.middleware.test.ts`
- `apps/api/src/auth/auth-lifecycle-deny.middleware.ts`
- `apps/api/src/auth/better-auth-instance.test.ts`
- `apps/api/src/auth/better-auth-instance.ts`
- `apps/api/src/auth/better-auth.integration.test.ts`
- `apps/api/src/auth/verification-handoff.ts`
- `apps/api/src/bootstrap.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/tokens.ts`
- `apps/api/src/registration/registration.controller.ts`
- `apps/api/src/registration/registration.dto.ts`
- `apps/api/src/registration/registration.integration.test.ts`
- `apps/api/src/registration/registration-problem.filter.ts`
- `apps/api/src/registration/registration.service.ts`
- `packages/contracts/openapi.json`
- `packages/contracts/src/generated/api-types.ts`
- `tests/architecture-boundaries.test.js`

## Unresolved Questions

- **Epic AC conflict:** Epic 1.4 nói verification token “không thể dùng lại”, nhưng Better Auth 1.6.23 email verification dùng signed JWT và replay sau lần đầu là no-op success; AD-9 cấm second token store. Product/architecture owner cần xác nhận idempotent no-second-side-effect semantics được chấp nhận, hoặc sửa architecture trước khi yêu cầu strict replay rejection.
