---
baseline_commit: 4eb70ab92094310d026686c0352370c27b9c806d
---

# Story 1.1: Khởi tạo secure application shell

Status: review

## Story

As a marketer,
I want a public sign-in entry on a secure application foundation,
so that account and campaign features have a stable starting point.

## Requirements Traceability

- **Foundation:** FR-1, FR-2, FR-3. This story does not claim authentication behavior.
- **Deferred:** NFR-4/NFR-7 → Stories 1.3 and 1.5; NFR-15 → Stories 3.1–3.3. No session-cookie, CSRF-mutation or redirect-durability evidence is required here.
- **Applied UX:** UX-DR1, applicable parts of UX-DR17, UX-DR21 and UX-DR22. Auth form behavior (UX-DR3/18), authenticated AppShell (UX-DR2), overlay lifecycle (UX-DR19) and mock screens (UX-DR24) are deferred to their owning stories.

## Acceptance Criteria

1. **Given** repository chưa có application runtime
   **When** workspace được bootstrap
   **Then** monorepo chứa `apps/web`, `apps/api`, `apps/worker`, `packages/application`, `packages/domain`, `packages/db`, `packages/contracts`, `packages/observability`
   **And** dùng Node `>=22.22.0`, React/React DOM `19.2.7`, React Router `8.2.0`, Vite `8.1.5`, NestJS `11.1.28`, Drizzle `0.45.2` và Better Auth `1.6.23`.

2. **Given** các package đã được tạo
   **When** architecture checks chạy
   **Then** forbidden dependency direction làm CI thất bại, gồm `packages/domain` import React/NestJS/Drizzle/Better Auth và `apps/worker` import HTTP controllers.
   **And** checks cũng bảo vệ web chỉ dùng generated-contract boundary, API/worker gọi `packages/application`, domain không import browser/framework/adapter, `packages/db` chỉ implement application ports và không có reverse/cross-layer import.

3. **Given** marketer mở `/sign-in` hoặc `/sign-up` trên desktop hoặc mobile
   **When** public route được tải
   **Then** static auth shell hiển thị page title, main heading, semantic landmarks, skip link, visible focus ring và native links giữa hai route
   **And** dùng token từ `DESIGN.md`
   **And** không render submit/password/Google controls, không gọi network và không báo authentication success giả
   **And** hoạt động tại 320 CSS px/400% zoom mà không có page-level two-dimensional scroll.

4. **Given** PostgreSQL không khả dụng nhưng cấu hình hợp lệ
   **When** gọi `GET /health/live` và `GET /health/ready` không cần authentication
   **Then** `/health/live` trả HTTP `200` với JSON ổn định `{\"status\":\"ok\"}` và không truy cập PostgreSQL
   **And** `/health/ready` trả HTTP `503` với JSON ổn định `{\"status\":\"unavailable\"}` sau bounded connection probe
   **And** cả hai trả `Content-Type: application/json`, `Cache-Control: no-store`, không chứa DSN/stack/connection detail
   **And** process không crash, không unhandled rejection và logs không lộ credentials/secrets.

5. **Given** required production configuration bị thiếu hoặc malformed
   **When** process khởi động
   **Then** process fail fast trước khi listen
   **And** lỗi không in giá trị config/secret. Khi config hợp lệ nhưng database unreachable, chỉ readiness fail; liveness vẫn `200`.

## Scope Boundary

- Tạo greenfield foundation, static public auth shell, runtime skeleton, health contract và minimal dependency-boundary checks.
- Không triển khai login/signup mutation, Better Auth handler/schema, session store, email verification, Google OAuth, CSRF mutation flow, link model, analytics, queue, generated OpenAPI client hoặc authenticated navigation Dashboard/Links/Account.
- `/sign-in`, `/sign-up`, `/health/live` và `/health/ready` là route contracts của story; `/sign-in` và `/sign-up` được ghi vào fixed reserved-route registry để không tranh chấp short-path namespace về sau.
- Không claim same-origin Nest static hosting, protected-route smoke hoặc reusable component inventory; các phần đó thuộc Story 1.2. Vite dev/test serving là đủ cho web shell của story này.
- Security headers ngoài mức baseline cần cho shell được defer tới Stories 1.2/1.3; không để từ “secure” được hiểu là đã hoàn tất auth/CSRF hardening.
- Không provision Render/managed PostgreSQL production, migrations, backup/PITR, restore drill hoặc full worker operations; worker chỉ cần process entrypoint và bounded SIGTERM cleanup seam.
- `README.md` không tồn tại trong repo; không tạo file chỉ để thỏa workflow.

## Tasks / Subtasks

- [x] **1. Bootstrap workspace và toolchain (AC: 1)**
  - [x] Dùng npm workspaces; root `package.json` có `packageManager: "npm@10.9.4"`, `engines.node: ">=22.22.0"`, lockfile committed và ESM config.
  - [x] Pin exact React, React DOM, React Router, Vite, NestJS, Drizzle ORM, Drizzle Kit `0.31.10`, Better Auth, Vitest `4.1.10`, Playwright `1.61.1` và exact TypeScript 5.x đã chọn trong lockfile; không nâng dependency.
  - [x] Tạo `.node-version`/CI Node `22.22.0`, `.gitignore`, `tsconfig`, package `exports`; mọi workspace có `"type":"module"`.
  - [x] Tạo tám roots đúng Structural Seed; không thêm business schema/auth schema/queue.

- [x] **2. Runtime và health (AC: 3–5)**
  - [x] Tạo Vite/React entrypoint, tạo React Router 8 Data Mode router một lần ngoài React tree; dùng `react-router` và `react-router/dom`, không dùng `react-router-dom`.
  - [x] Render static `/sign-in` và `/sign-up` pages với native links, không dead submit/auth controls.
  - [x] Tạo Nest composition root và `GET /health/live`, `GET /health/ready`; readiness chỉ kiểm tra connectivity, không schema/migration.
  - [x] DB probe có connect timeout và statement timeout 1 giây, không retry vô hạn; dùng connector port với driver `pg` được khóa trong root lockfile.
  - [x] Missing config fail startup; unreachable DB giữ process sống và chỉ trả readiness `503`.
  - [x] Worker có minimal entrypoint, không import HTTP controllers, xử lý SIGTERM và đóng listener/pool trong bounded deadline; polling/queue thuộc Epic 3.

- [x] **3. Public auth shell (AC: 3)**
  - [x] Dùng semantic landmarks, skip link, title, heading, native links, keyboard focus và route-change title/heading; không thêm authenticated nav.
  - [x] Dùng Calm Analytics light tokens: page `#F9F9F7`, surface `#FCFCFB`, ink `#0B0B0B`, primary `#1C5CAB`, border `#E1E0D9`, system sans 16px/1.5, heading 650, spacing 4px, radii 6/8/12px, focus ring 2px offset 2px.
  - [x] Test 320 CSS px, 400% zoom, 200% text spacing, `prefers-reduced-motion`, no overflow và focus ring không bị clip; contrast rendered text/link/focus/error states phải đạt ngưỡng WCAG AA theo vai trò. Chỉ claim target, không claim full conformance.

- [x] **4. Boundary enforcement và CI (AC: 2)**
  - [x] Có một enforcement source of truth với script cố định `npm run test:architecture`; resolve package exports/path aliases và dynamic-import paths trong khả năng tooling.
  - [x] Thêm negative fixtures: inject forbidden domain import và worker-controller import, assert checker exit non-zero; positive graph test phải pass.
  - [x] Scripts cố định: `npm run typecheck`, `npm run test`, `npm run test:architecture`, `npm run build`; CI chạy các script và production web build.
  - [x] `packages/contracts` chỉ là manifest/export boundary trống; không hand-edit hoặc generate OpenAPI trong story này.

- [x] **5. Verification evidence (AC: 1–5)**
  - [x] Test exact versions, ESM loading, package graph, auth shell route/landmarks/title/links/focus/reflow.
  - [x] Test liveness `200` không DB, readiness `503` với deterministic unreachable connector và một integration path thật khi PostgreSQL khả dụng.
  - [x] Assert valid JSON, correlation ID và sanitization ở health access/error logs; không ghi DSN/password/token/cookie/raw IP/forwarded headers/full referrer/User-Agent/full destination query/verification secret.
  - [x] Inject sentinel config chỉ trong test và assert sentinel không xuất hiện trong HTTP/log output; artifact `.env*` scan chỉ kiểm tra build output thật.
  - [x] Playwright acceptance chỉ chạy CI/Linux, WSL hoặc Windows 11; Windows 10 local không phải acceptance evidence.

### Review Findings

- [ ] [Review][Patch] Readiness requests can wait unbounded behind the single pool connection [apps/api/src/app.module.ts:8]
- [ ] [Review][Patch] Readiness query can hang after connection succeeds because no client-side query deadline exists [packages/db/src/index.ts:17]
- [ ] [Review][Patch] Readiness pool is not closed through Nest shutdown lifecycle [apps/api/src/app.module.ts:8]
- [ ] [Review][Patch] HealthService bypasses the published readiness DI token [apps/api/src/app.module.ts:14]
- [ ] [Review][Patch] API configuration is loaded twice during bootstrap [apps/api/src/app.module.ts:7]
- [ ] [Review][Patch] Reserved-route registry is inert and cannot enforce route collision policy [apps/web/src/routes/reserved-routes.ts:1]
- [ ] [Review][Patch] Link color uses an off-spec token instead of DESIGN primary [apps/web/src/styles.css:13]
- [ ] [Review][Patch] SPA route changes are not announced to assistive technology [apps/web/src/routes/auth-page.tsx:11]
- [ ] [Review][Patch] Health contract lacks automated HTTP-level regression coverage [apps/api/src/health/health.test.ts:4]
- [ ] [Review][Patch] Worker shutdown has no explicit bounded cleanup contract [apps/worker/src/main.ts:5]
- [ ] [Review][Patch] DATABASE_URL accepts invalid PostgreSQL connection parameters instead of failing startup [apps/api/src/config.ts:10]
- [ ] [Review][Patch] Malformed request targets can throw asynchronously in request logging [apps/api/src/request-logger.middleware.ts:22]
- [ ] [Review][Patch] SPA navigation leaves focus on a control whose meaning changed [apps/web/src/routes/auth-page.tsx:29]

## Dev Notes

### Greenfield and file ownership

- Repo chỉ có tracked `URL_shortener.jpg`; không có source, manifest, lockfile, tests, CI, README hoặc implementation story trước đó. Không có `UPDATE`; mọi file là `NEW`.
- Dự kiến: root manifests/config/CI; `apps/web` Vite entry/router/routes/styles; `apps/api` Nest entry/health/config; `apps/worker` entrypoint; mỗi `packages/*` manifest/export; tests cho architecture, health, config, shell và logging. Exact filenames phải tuân kebab-case.
- `packages/contracts` chưa có generated output. Generated contracts và Better Auth/Drizzle migrations thuộc Story 1.3.

### Architecture guardrails

- `ARCHITECTURE-SPINE.md#Design Paradigm`, AD-1, AD-2, AD-9, AD-14, AD-16, AD-18 và AD-19 là authority.
- Domain framework-free; web không import DB/domain/API internals; API/worker gọi application; DB implement ports; worker không import controllers; mutation sau này chỉ qua application use case.
- One public origin và reserved prefixes (`/api/*`, `/api/auth/*`, health, static, `/sign-in`, `/sign-up`) phải được giữ trong một registry. Không thêm CORS/multi-origin workaround.
- Config validate lúc startup; logs structured JSON/correlation ID và sanitize mọi ingress/error field. Không commit `.env`, credentials, OAuth secret hoặc production URL chứa secret.
- Better Auth là auth owner duy nhất; Story 1.1 chỉ giữ ESM/package seam. `bodyParser:false`, `toNodeHandler` ordering và CSRF integration thuộc Story 1.3.

### Technical guardrails

- ESM mọi workspace; Node relative imports có `.js` ở emitted runtime. Không CommonJS.
- React Router 8.2.0: `createBrowserRouter` từ `react-router`, `RouterProvider` từ `react-router/dom`; không cài/import `react-router-dom`.
- Vite 8.1.5 dùng ESM/Rolldown; production build là compatibility gate, không dùng plugin/config Rollup/esbuild chưa kiểm chứng.
- Nest 11 aligned Express 5; unnamed wildcard không hợp lệ. Story 1.1 chưa mount Better Auth.
- PostgreSQL readiness là connectivity-only; schema readiness/migrations thuộc story sau. Driver `pg` và exact patch được khóa trong root lockfile, không invent second database adapter.
- Giữ code dưới 200 dòng khi có logical separation; YAGNI/KISS/DRY.

### UX and security

- `DESIGN.md` sở hữu visual tokens, `EXPERIENCE.md` sở hữu behavior; mocks không override spine.
- Public auth shell không có form mutation, password field, Google button, fake success hoặc protected navigation. Stories 1.4–1.6 sở hữu auth controls/states.
- Accessibility là target; kiểm tra role-specific contrast vì accessibility review ghi nhận một số token không đạt AA ở mọi cách dùng. Không dùng low-contrast token cho body/focus.
- Baseline response headers, auth/session cookies, CSRF, CSP/HSTS policy đầy đủ và security review thuộc Stories 1.2/1.3; không giả vờ hoàn tất trong story này.

## Testing Requirements

- `npm run typecheck`, `npm run test`, `npm run test:architecture`, `npm run build` phải pass; không bỏ qua failure.
- Architecture tests phải có negative fixtures, không pass chỉ vì package rỗng.
- Health tests phải phân biệt missing config (startup fail) với unreachable DB (liveness `200`, readiness `503`), bounded timeout, no unhandled rejection và sanitized structured logs.
- Web tests phải xác nhận `/sign-in`/`/sign-up`, title/heading/landmarks/skip link/native links, keyboard focus, 320px/400%/200% spacing, reduced motion, no overflow và contrast.
- Không claim session, CSRF, redirect durability, full WCAG AA, same-origin static hosting hoặc OpenAPI generation ở Story 1.1.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.1: Khởi tạo secure application shell`]
- [Source: `_bmad-output/project-context.md#Technology Stack & Versions`]
- [Source: `_bmad-output/project-context.md#Critical Implementation Rules`]
- [Source: `_bmad-output/project-context.md#Testing Rules`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md#Invariants & Rules`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md#Stack`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md#Structural Seed`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-url_shortener_system-2026-07-19/DESIGN.md#Brand & Style`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-url_shortener_system-2026-07-19/DESIGN.md#Colors`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md#Accessibility Floor`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md#Responsive & Platform`]
- [Source: `https://reactrouter.com/start/modes`]
- [Source: `https://nodejs.org/docs/v22.22.0/api/esm.html`]
- [Source: `https://docs.npmjs.com/cli/v11/using-npm/workspaces`]
- [Source: `https://vite.dev/blog/announcing-vite8`]
- [Source: `https://expressjs.com/en/guide/migrating-5.html`]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Bootstrapped pinned npm ESM monorepo with eight application/package roots and locked runtime toolchain.
- Added static `/sign-in` and `/sign-up` shell with Calm Analytics tokens, responsive reflow and keyboard-accessible navigation.
- Added API liveness/readiness contract, bounded PostgreSQL probe, sanitized structured logging and graceful worker shutdown.
- Added architecture negative fixtures, toolchain/config/health/UX tests, production build and Playwright acceptance coverage.
- Validation passed: clean `npm ci --ignore-scripts --dry-run`, `npm run check`, `npm run test:e2e`, degraded health smoke and `git diff --check`.
- Review fixes applied: synchronized lockfile, validated complete PostgreSQL URLs, blocked re-export/DB boundary bypasses, recursively redacted nested secrets and restored skip-link-first focus order.
- Local checks ran on Node 22.16.0 with expected engine warnings; CI and `.node-version` pin required Node 22.22.0.

### File List

- `package.json`, `package-lock.json`, `tsconfig.base.json`, `vitest.config.ts`, `playwright.config.ts`, `.node-version`, `.gitignore`
- `.github/workflows/ci.yml`
- `apps/web/**`, `apps/api/**`, `apps/worker/**`
- `packages/application/**`, `packages/domain/**`, `packages/db/**`, `packages/contracts/**`, `packages/observability/**`
- `tests/**`
- `_bmad-output/implementation-artifacts/1-1-khoi-tao-secure-application-shell.md`

## Change Log

- 2026-07-20: Implemented Story 1.1 foundation and verification gates.
