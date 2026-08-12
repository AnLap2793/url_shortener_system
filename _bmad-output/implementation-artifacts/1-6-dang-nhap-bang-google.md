---
baseline_commit: 325ac92
---

# Story 1.6: Đăng nhập bằng Google

Status: in-progress — Google OAuth authorization-code implementation approved

## Story

Là một marketer,
Tôi muốn đăng nhập bằng tài khoản Google,
Để tôi truy cập workspace mà không cần tạo password mới.

## Requirements Traceability

- **FR-2, FR-3** — Google OAuth authorization-code sign-in, canonical session và collision-safe account lifecycle.
- **NFR-4, NFR-7, NFR-10** — secure cookie, exact same-origin mutation boundary, Better Auth `state` và PKCE S256; OIDC hardening deferred.
- **AD-2, AD-9, AD-14, AD-18, AD-19, AD-20** — one public origin; Better Auth vẫn là sole owner; Nest/OpenAPI contract; CSRF; reproducible integration evidence; explicit Google security debt.
- **UX-DR3, UX-DR17, UX-DR18, UX-DR22** — accessible auth control, errors, keyboard và reflow 320px.
- **Story 1.7 boundary** — Google linking chỉ sau verified-email fresh re-authentication; không thuộc Story này.

## Security Debt — Must Remain Explicit

Better Auth `1.6.23` social authorization-code flow có opaque database-backed signed-cookie `state` và PKCE S256. Source không chứng minh atomic state consumption, authorization-request OIDC `nonce`, hoặc authorization-code callback ID-token signature/JWKS/issuer/audience/expiry/nonce validation.

1. Story 1.6 chỉ yêu cầu `state` và PKCE S256. Không gọi flow này là OIDC verified hoặc tuyên bố các bảo đảm không có bằng chứng.
2. OIDC `nonce`, cryptographic ID-token validation và atomic state-consume là security hardening deferred đến khi Better Auth upstream có public capability đã kiểm chứng bằng source và PostgreSQL integration evidence.
3. Better Auth tiếp tục là sole owner. Không tự tạo OAuth callback, token/session/state/nonce store, code exchange hoặc architecture extension song song.
4. Story giữ `backlog`: người dùng chỉ duyệt thay đổi tài liệu, chưa duyệt cấu hình, UI, Nest facade hay phát hành Google sign-in.

## Acceptance Criteria

1. **Khởi tạo OAuth authorization-code qua boundary đã chốt**
   - **Given** marketer chưa đăng nhập, Google provider được cấu hình hoàn chỉnh và browser ở Sign in
   - **When** họ chọn “Continue with Google”
   - **Then** browser khởi tạo flow qua Nest facade được cho phép rõ ràng; browser không gọi raw Better Auth lifecycle route
   - **And** Better Auth dùng `PUBLIC_ORIGIN` exact, callback `${PUBLIC_ORIGIN}/api/auth/callback/google`, không wildcard origin/callback
   - **And** authorization request dùng opaque `state` và PKCE S256; OIDC `nonce`, atomic state-consume và cryptographic ID-token validation là security hardening deferred
   - **And** callback GET từ Google là exception provider-return hẹp tại raw Better Auth handler, không phải React SPA route và không nhận SPA fallback.

2. **Tạo canonical Google account và session**
   - **Given** Google callback hợp lệ trả Google principal mới và `sub` hợp lệ theo provider response Better Auth xử lý
   - **When** callback hoàn tất
   - **Then** Better Auth tạo đúng một canonical user và Google account identity, phát session cookie `HttpOnly`, `SameSite=Lax`, host-only và `Secure` tại production HTTPS
   - **And** marketer tới intended protected route an toàn hoặc `/dashboard`
   - **And** `/api/me` resolve cùng canonical string `ActorId`; không trả OAuth token, authorization code hoặc Better Auth token trong JSON/log.

3. **Đăng nhập identity Google đã liên kết, không duplicate ownership**
   - **Given** Google `sub` đã liên kết với canonical user
   - **When** callback hợp lệ hoàn tất
   - **Then** Better Auth đăng nhập đúng user cũ, không tạo user/account/ownership thứ hai
   - **And** canonical owner/session behavior của Story 1.5 không đổi.

4. **Email collision không auto-link hoặc auto-merge**
   - **Given** Google trả verified email trùng một email/password account chưa có Google identity liên kết
   - **When** callback được xử lý
   - **Then** không tạo user/account/session mới, không login theo email claim và không thay đổi ownership
   - **And** browser trở về `/sign-in` với guidance không-enumerating: Google chưa được liên kết; hãy đăng nhập email/password rồi dùng Account → Link Google
   - **And** giữ `redirectTo` chỉ khi nó qua allowlist `/dashboard`, `/links`, `/account`; Story 1.7 sở hữu re-authentication và explicit link.

5. **Failure/cancel/tamper fail closed**
   - **Given** callback thiếu, altered, expired hoặc replayed `state`; Google trả cancel; PKCE, authorization code hoặc provider exchange thất bại; hoặc response network/server lỗi
   - **When** flow kết thúc
   - **Then** không tạo partial user/account/session và không mutate account hiện có; cleanup state/verification được phép
   - **And** browser quay về Sign in với generic recoverable message, có retry/email-password action và giữ intended protected route an toàn
   - **And** security event chỉ chứa category/correlation ID; không log raw email, `code`, token, `state`, `nonce`, cookie hoặc full callback query.

6. **Configuration và route boundary fail closed**
   - **Given** `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` chỉ có một giá trị, production thiếu provider config, `PUBLIC_ORIGIN` không phải HTTPS hoặc callback/origin không exact
   - **When** API khởi động/readiness
   - **Then** process fail fast với message không chứa secret; không có fallback client/callback/origin
   - **And** local development có thể tắt Google chỉ khi cả hai Google variables đều absent; UI không quảng cáo flow không thể chạy
   - **And** raw `/api/auth/sign-in/social` và email/session lifecycle routes tiếp tục bị deny trước Better Auth; chỉ exact `/api/auth/callback/google` được mở cho provider callback.

7. **Accessible Sign in và executable evidence**
   - **Given** marketer dùng keyboard, screen reader, password manager hoặc 320 CSS px
   - **When** Sign in render và OAuth flow thay đổi state
   - **Then** “Continue with Google” là native control, sign-in-only, có accessible name, focus ring, ≥44×44px, loading duplicate protection và không làm regress email/password form
   - **And** cancellation/collision/security/provider error là visible `role="alert"`, không toast-only
   - **And** unit, real PostgreSQL/provider-boundary integration, browser E2E, contract/architecture/generation gates đều pass; Windows 10 local Playwright chỉ supplemental, CI/Linux/WSL/Windows 11 là acceptance evidence.

## Scope Boundary and Locked Decisions

- **Current approval:** chỉ sửa tài liệu. Google provider configuration, Nest facade, UI, callback enablement, config/runbook/generated contract updates và release chưa được duyệt.
- **Future implementation scope:** safe provider start facade; official Better Auth callback; collision-safe sign-in; UI states; validation/evidence.
- **Ngoài scope:** Google linking, Account “Link Google”, fresh re-authentication, password reset, additional providers, Google API access, offline access/refresh-token scopes, custom OAuth server, custom session/token store, wildcard origins.
- **One auth owner:** Better Auth owns user, Google account identity, `state`/PKCE lifecycle, code exchange, session and cookies. OIDC `nonce`, cryptographic ID-token validation và atomic state-consume chưa được runtime chứng minh. Nest facade chỉ được khởi tạo browser navigation; không parse/store OAuth secret hoặc tự phát session cookie.
- **Collision policy:** `account.accountLinking.disableImplicitLinking: true` is mandatory. Do not configure Google as a trusted provider and do not use `accountLinking.enabled: false`, because Story 1.7 needs future explicit linking.
- **Identity policy:** stable Google identity is `sub`; email is not a user primary key. `email_verified` must satisfy the documented provider contract before new-account policy is accepted.
- **Callback safety:** exact registered URI is `${PUBLIC_ORIGIN}/api/auth/callback/google`; no dynamic host, wildcard, suffix-match, request-derived origin or trailing-slash variant. Post-callback redirect is clean and allowlisted; no auth query persists in address bar after completion.
- **Browser boundary:** existing email/password sign-in/sign-out remains generated Nest facade only. Google start is native same-origin POST to a Nest facade; callback is the narrow external-provider return exception. Update architecture negative test to forbid raw social start from `apps/web`.
- **No hand edits:** generated OpenAPI/types update only if a Nest Google-start DTO/controller changes the API contract. Raw Better Auth callback never enters OpenAPI.

## Tasks / Subtasks

- [x] Task 0: Record the approved OAuth security-debt scope (AC: 1, 5)
  - [x] 0.1 Verify Better Auth `1.6.23` has database-backed signed-cookie `state` and PKCE S256 for Google authorization-code flow.
  - [x] 0.2 Record unproven capabilities as deferred: atomic state-consume, authorization-request OIDC `nonce`, and authorization-code callback ID-token signature/JWKS/issuer/audience/expiry/nonce validation.
  - [x] 0.3 Amend PRD, architecture, epics and project context to require state + PKCE, preserve Better Auth as sole owner and prohibit automatic email linking.
  - [x] 0.4 Keep Story 1.6 `backlog`: documentation-only approval does not authorize Google configuration, Nest facade, UI or release.

- [ ] Task 1: Validate provider configuration and Better Auth composition (AC: 1, 2, 4, 6)
  - [ ] 1.1 Extend `ApiConfig`/`loadConfig()` with paired `googleClientId`/`googleClientSecret`; absent pair disables local Google UI, partial pair always fails, production requires complete pair. Error text must never include secret.
  - [ ] 1.2 Configure `socialProviders.google` from validated values, `baseURL: publicOrigin`, exact `trustedOrigins: [publicOrigin]`, fixed callback URI and `disableImplicitLinking: true`; preserve logger disabled, email verification, disabled Better Auth rate limiter and cookie defaults.
  - [ ] 1.3 Do not request offline access, Google API scopes or token persistence beyond what Better Auth needs for identity.
  - [ ] 1.4 Update `.env.example`, `compose.yaml` and README with variable names/placeholders and exact Google Cloud redirect registration; never place credentials in repository or worker environment.

- [ ] Task 2: Implement the constrained OAuth navigation boundary (AC: 1, 5, 6)
  - [ ] 2.1 Add the minimum Nest `/api/authentication` Google-start facade. Browser uses native same-origin `POST` form with validated `redirectTo`; facade fixes provider `google`, enforces existing exact `Origin` + `Sec-Fetch-Site: same-origin` and returns provider `303` Location.
  - [ ] 2.2 Build success/error/new-user URLs exclusively from existing `safeRedirectTo()` allowlist. Preserve permitted query, reject external/protocol-relative/backslash/encoded separator/dot-segment/fragment values and fall back `/dashboard`.
  - [ ] 2.3 Replace current raw auth blocklist with exact callback method/path allowlist. Deny raw social start, email/session lifecycle and every unowned raw route with RFC 9457 `404`, `no-store`; retain trailing-slash normalization and negative tests.
  - [ ] 2.4 Ensure callback/collision/cancel/security/provider error redirects land only on typed local `/sign-in` states and contain no provider `error`, `error_description`, raw query, token, code or state.

- [ ] Task 3: Implement sign-in UI without email/password regressions (AC: 2–5, 7)
  - [ ] 3.1 Render an accessible sign-in-only native `POST` form/control to Nest start facade. Use document navigation, not `better-auth` browser SDK, raw `/api/auth/*`, generated-client workaround or optimistic session mutation.
  - [ ] 3.2 Add typed local status parsing for allowed OAuth outcomes; show calm generic `role="alert"` copy for cancelled, collision, security and unavailable states; retain only safe intended route.
  - [ ] 3.3 Preserve existing email normalization, password clearing/no persistence, current-password autocomplete, form errors, resend verification route, password-reset limitation, skip link, focus behavior and reflow.

- [ ] Task 4: Add proof at all boundary layers (AC: 1–7)
  - [ ] 4.1 Config/composition unit tests: paired variables, production HTTPS, exact callback, disabled implicit linking, no trusted Google provider, no secret in errors.
  - [ ] 4.2 Lifecycle/boot integration: raw email/session/social start denylist, exact callback GET allowed and never SPA fallback; bad Google-start CSRF headers return `403` before state/session mutation.
  - [ ] 4.3 Use a controlled OAuth provider boundary and real PostgreSQL: new provider principal, existing linked `sub`, email/password collision, cancel, provider/code-exchange failure, missing/altered/expired/replayed state, concurrent callbacks and cookie/session continuity. For every rejected callback/collision assert zero new `user`, `account`, `session` rows; state cleanup is allowed.
  - [ ] 4.4 Browser E2E: native POST control, safe route round-trip, provider `303`, callback success, collision/cancel/failure/security messages, clean browser URL, keyboard and 320px. Provider stub does not replace PostgreSQL callback/session evidence.
  - [ ] 4.5 Update architecture negative fixtures to reject raw social calls/imports from web and test raw callback allowlist deny paths/methods. Regenerate OpenAPI/types only if facade changes Nest DTO source; run `npm run verify:contracts` rather than hand-edit artifacts.

- [ ] Task 5: Validate, review and document (AC: 7)
  - [ ] 5.1 Run compile/typecheck after each code change; then real-PostgreSQL `npm run check`, `npm run test:e2e`, Google-specific integration suite, config/Compose validation and migration generation gate.
  - [ ] 5.2 Run code-reviewer after all tests pass; resolve security/correctness findings, especially state/PKCE, collision, open-redirect and log-redaction regressions.
  - [ ] 5.3 Update Story evidence truthfully: document the deferred nonce/ID-token/atomic-state gaps and state that production `Secure` cookie evidence requires a trusted TLS CI boundary if one is unavailable; do not call Windows 10 local E2E acceptance evidence.

## Dev Notes

### Previous Story Intelligence

- Story 1.5 establishes Better Auth as sole owner and a strict browser Nest-facade boundary. Preserve `bodyParser:false`, ESM, middleware order, `Set-Cookie` forwarding, immutable `ActorId`, production HTTPS validation and exact same-origin mutation headers.
- Email/password raw lifecycle paths are intentionally denied before official handler. Google must not accidentally reopen these paths. The official callback needs only a narrow provider-return exception.
- Better Auth built-in limiter remains disabled because PostgreSQL owns email/password throttle policy. Google flow must not add a second session, limiter or token owner.
- Existing `safeRedirectTo()` rejects external URL, `//`, backslash, encoded slash/backslash and literal/encoded dot segments. Reuse it; do not write another redirect parser.
- Generated contracts are a reproducibility gate, not source to hand-edit. Existing real PostgreSQL tests prove auth/session semantics; browser E2E proves UX only.

### Existing Files to Update and Preserve

| File | Current state / required preservation | Expected story change |
| --- | --- | --- |
| `apps/api/src/config.ts`, `config.test.ts` | Validates DB, origin, secret, proxy, web dist; production requires HTTPS + one trusted proxy hop. | Add paired Google config with no secret leakage and production policy. |
| `apps/api/src/auth/better-auth-instance.ts` | One Better Auth composition root, Drizzle schema, exact origin, logger disabled, email config, rate limiter disabled. | Add selected-version Google provider and disable implicit linking only after Task 0. |
| `apps/api/src/bootstrap.ts` | Load-bearing middleware order. | Normally no code change; regression-test ordering and callback pass-through. |
| `apps/api/src/auth/auth-lifecycle-deny.middleware.ts` | Current blocklist denies selected raw email/session lifecycle with normalized trailing slash and `404 no-store`; unknown raw routes pass through. | Replace with exact callback method/path allowlist after Task 0; deny social start and every other raw route. |
| `apps/api/src/authentication/*` | Nest email sign-in/sign-out facade and RFC 9457 handling. | Add smallest Google-start facade/DTO/filter behavior if Task 2 confirms Better Auth API. |
| `apps/web/src/routes/authentication-actions.ts` | Generated email/sign-in/out client and strict redirect parser. | Extract only reusable safe OAuth URL/status helpers; no raw OAuth request. |
| `apps/web/src/routes/auth-page.tsx`, `router.tsx` | Accessible email/password sign-in/up and protected routes. | Add sign-in-only document-navigation control and status UI; no SPA callback route. |
| `tests/architecture-boundaries.test.js` | Blocks Better Auth imports and raw email lifecycle calls in web. | Add raw social negative fixture; permit no broad OAuth bypass. |
| `apps/api/src/auth/better-auth.integration.test.ts`, `apps/api/src/registration/registration.integration.test.ts` | Real bootstrap/PostgreSQL auth lifecycle and CSRF coverage. | Add focused OAuth authorization-code suite; split into new file if this would exceed 200 lines. |
| `apps/web/src/routes/*auth*.test.ts*`, `tests/e2e/authentication-flow.spec.ts` | Tests sign-in/out behavior and browser UX. | Add Google control/status/safe-redirection coverage without weakening existing assertions. |
| `.env.example`, `compose.yaml`, `README.md` | Local Docker avoids tracked secrets. | Add placeholder/runbook only; never expose credentials to worker. |

### Security and Privacy Guardrails

- Không log raw IP, email, password, cookie, verification secret, full referrer hoặc full Destination query.
- Also never log OAuth authorization code, access/refresh/ID token, `state`, `nonce`, provider error description or full callback query.
- Callback CSRF does not use the browser unsafe-mutation header protocol because Google returns a cross-site GET. Better Auth `state` is the callback correlation control and PKCE S256 protects authorization-code exchange; `nonce`, atomic state-consume and cryptographic ID-token validation remain deferred.
- Do not call the provider response OIDC verified, trust email as provider identity or auto-link by email. Google `sub` remains the identity key.
- Keep cookie defaults. Do not set `useSecureCookies` globally because local HTTP Docker would break Story 1.5 sessions; production `PUBLIC_ORIGIN` HTTPS derives secure behavior.
- Do not create account/user/session from error, cancel, collision, malformed callback or provider dependency failure. Do not return account-existence detail.

### Testing Requirements and Evidence Limits

- Provider-boundary stubs are allowed only for Google network responses; Better Auth callback, database schema, session cookie and collision behavior must run through the real composition root and PostgreSQL.
- Exercise missing, altered, expired and replayed `state`, cancellation, PKCE/code-exchange and provider failures; assert zero user/account/session mutation. State/verification cleanup is allowed.
- Verify the authorization redirect's exact registered callback URI, state + PKCE presence without writing their values to test output, and callback clean redirect without auth query leakage. Do not claim nonce or ID-token validation coverage as completed.
- Add a production HTTPS cookie integration assertion when CI offers trusted TLS termination. Until then, do not fabricate `Secure` evidence from local HTTP.
- Run `npm run check` with `INTEGRATION_DATABASE_URL` so PostgreSQL groups do not skip; run `npm run test:e2e` on supported acceptance OS/CI.

### Project Structure Notes

- No DB migration is expected if selected Better Auth version schema is compatible. If an upgrade emits schema change, generate reviewed forward-only Drizzle migration, prove clean-db and existing-db upgrade, then regenerate required artifacts.
- Keep runtime files under 200 lines when a real separation exists. A new focused OAuth integration test is preferable to expanding registration integration past that boundary.
- Không đổi dependency trong phạm vi chỉ sửa tài liệu. Không dùng `node:crypto`/platform primitives để tạo application-owned OAuth/OIDC protocol state.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.6`, `#Story 1.7`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-url_shortener_system-2026-07-19/prd.md#FR-2`, `#FR-3`, `#NFR-4`, `#NFR-7`, `#NFR-10`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md#AD-2`, `#AD-9`, `#AD-14`, `#AD-18`, `#AD-19`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md#State Patterns`, `#Accessibility Floor`, `#UJ-3`]
- [Source: `_bmad-output/project-context.md#Framework-Specific Rules`, `#Testing Rules`, `#Critical Don't-Miss Rules`]
- [Source: `_bmad-output/implementation-artifacts/1-5-dang-nhap-va-quan-ly-session.md#Scope Boundary and Locked Decisions`, `#Review Findings`]
- [Source: `apps/api/src/{config.ts,bootstrap.ts,auth/better-auth-instance.ts,auth/auth-lifecycle-deny.middleware.ts}`]
- [Source: `apps/web/src/routes/{authentication-actions.ts,auth-page.tsx,router.tsx}`]
- [Source: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)]
- [Source: [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)]
- [Source: [OAuth 2.0 Security Best Current Practice (RFC 9700)](https://www.rfc-editor.org/rfc/rfc9700.html)]

## Dev Agent Record

### Agent Model Used

cx/gpt-5.6-sol (Claude Code)

### Debug Log References

- Better Auth `1.6.23` and upstream `1.6.27` source analysis found state + PKCE but no proven OIDC nonce lifecycle, atomic state-consume or authorization-code ID-token validation. These controls are deferred until an upstream public capability is source-proven.
- `@better-auth/cli` is pinned separately at `1.4.21`; do not regenerate or align schema casually during any runtime upgrade.
- Existing `apps/web` architecture gate prohibits raw Better Auth calls/imports. Google start must remain Nest facade; only official callback is external provider-return boundary.

### Completion Notes List

- Documentation scope approved: Better Auth `1.6.23` Google authorization-code flow requires `state` and PKCE S256. OIDC `nonce`, cryptographic ID-token validation và atomic state-consume remain deferred until upstream support is source-proven.
- Story remains `backlog`; no Google configuration, Nest facade, UI, callback enablement, runtime code, credentials, dependency upgrade, migration, branch, commit or push was performed.

### File List

- NEW: `_bmad-output/implementation-artifacts/1-6-dang-nhap-bang-google.md`

## Change Log

- 2026-08-12: Created comprehensive Story 1.6 developer guide and recorded source analysis of the missing OIDC hardening controls. No application-owned OIDC extension is approved.
- 2026-08-13: User approved documentation-only reduction to OAuth authorization-code `state` + PKCE S256. OIDC `nonce`, cryptographic ID-token validation and atomic state-consume are explicit deferred security hardening; runtime implementation remains unapproved.

## Unresolved Questions

- Which future Better Auth release exposes a source-proven public capability for atomic state consumption, OIDC `nonce` and cryptographic ID-token validation, so deferred hardening can be scheduled?
