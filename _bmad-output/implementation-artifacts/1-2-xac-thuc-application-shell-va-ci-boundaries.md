---
baseline_commit: 648d0e92a330730ac277979fcc745f4498210023
---

# Story 1.2: Xác thực application shell và CI boundaries

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Là một builder,
Tôi muốn application shell và package boundaries có executable checks,
Để foundation không drift khi các feature được triển khai độc lập.

## Requirements Traceability

- **FR-1, FR-2, FR-3** (nền tảng truy cập an toàn) — story này không triển khai auth flows; nó dựng host/shell/guard seam mà Stories 1.3–1.7 sẽ gắn auth thật vào.
- **NFR-4** — protected route yêu cầu authenticated session trước khi hiển thị dữ liệu (ở story này: chưa tồn tại session ⇒ redirect về `/sign-in`).
- **NFR-9** — reserved route registry mở rộng cho các root application route mới (`/dashboard`, `/links`, `/account`).
- **UX-DR16/17/19/21/22** — component foundation, WCAG 2.2 AA floor, modal/drawer lifecycle, reduced motion, reflow.
- **AD-1, AD-2, AD-9, AD-16, AD-19** — dependency direction, one public origin + reserved precedence, auth ownership seam, operational evidence, reproducible evidence.

## Acceptance Criteria

1. **Same-origin production host**
   **Given** web application khởi động
   **When** smoke test tải public auth route và protected route
   **Then** static SPA assets được serve same-origin bởi NestJS production host
   **And** browser route refresh không trả 404
   **And** protected route yêu cầu session trước khi hiển thị dữ liệu.

2. **Reusable UI foundation**
   **Given** reusable UI foundation được tạo
   **When** component contract tests chạy
   **Then** `AppShell`, `PrimaryButton`, `Toast/Banner`, `Dialog`, `ErrorSummary`, `EmptyState` và `FocusIndicator` dùng shared DESIGN tokens và behavior contract
   **And** controls có visible focus, disabled/loading semantics và target tối thiểu 44×44px
   **And** feature stories mở rộng foundation thay vì tạo duplicate component khác semantics.

3. **CI boundary gates**
   **Given** source code được kiểm tra trước merge
   **When** CI chạy
   **Then** typecheck, unit test, production build và architecture boundary test đều pass
   **And** `packages/domain` không import framework/adapters
   **And** `apps/worker` không import HTTP controllers.

4. **Dependency/runtime audit**
   **Given** production build được tạo
   **When** dependency/runtime audit chạy
   **Then** exact package versions và Node engine khớp architecture seed
   **And** lockfile không có unresolved drift
   **And** build artifact không chứa development secrets hoặc source `.env`.

5. **Responsive & keyboard smoke**
   **Given** layout được kiểm tra tại desktop, tablet, mobile, 320 CSS px và 400% zoom
   **When** keyboard smoke test chạy
   **Then** skip link, landmarks, page title, route announcement, drawer Escape/focus return và one-active-nav contract đều pass
   **And** không có two-dimensional page scroll ngoài labeled data-table region.

## Scope Boundary

**Trong scope:**
- NestJS serve static SPA + SPA fallback với reserved-route precedence; cache/nosniff headers; path-traversal safety.
- Session-gate seam: `GET /api/auth/session` trả 401 RFC 9457 (chưa tồn tại session nào); web protected layout loader redirect về `/sign-in?redirectTo=...`.
- Protected shell routes `/dashboard`, `/links`, `/account` (chỉ AppShell chrome + EmptyState placeholder — không data feature).
- 7 foundation components + component harness cho behavioral tests.
- Mở rộng reserved registry, architecture/toolchain/artifact gates, Playwright smoke trên NestJS host.

**NGOÀI scope (không được làm):**
- Better Auth mount, session issuance, cookies, CSRF headers, CSP/HSTS policy đầy đủ → Story 1.3.
- Auth forms/controls/password/Google button → Stories 1.4–1.6.
- `MetricCard`, `FilterBar`, `ChartCard`, `LinkTable` → feature stories sở hữu (UX-DR16 liệt kê đủ bộ nhưng epics AC2 của story này chỉ yêu cầu 7 components trên).
- `short_path_registry` lookup/root-path precedence động → Epic 2/3 (Story 3.1 sở hữu precedence thay đổi khi registry tồn tại).
- Dark mode, ECharts, analytics surfaces.

## Tasks / Subtasks

- [x] Task 1: NestJS same-origin production host (AC: 1, 4)
  - [x] 1.1 Mở rộng `apps/api/src/config.ts`: env `WEB_DIST_DIR` optional; khi set, resolve absolute path và fail-fast nếu `index.html` không tồn tại (không in giá trị env khi lỗi — pattern 1.1). Khi unset ⇒ static serving tắt (API-only mode, giữ nguyên hành vi 1.1).
  - [x] 1.2 Tạo `apps/api/src/web-static/static-assets.middleware.ts`: serve `GET/HEAD /assets/*` từ dist bằng `node:fs` streaming; content-type map tối thiểu (js/css/html/svg/ico/map/txt); path containment (resolve + kiểm tra prefix dist) chặn traversal; `Cache-Control: public, max-age=31536000, immutable` (hashed assets); `X-Content-Type-Options: nosniff`. KHÔNG cài `@nestjs/serve-static` hay `@types/express` — dùng structural typing local như `request-logger.middleware.ts` của 1.1 (tránh TS7016).
  - [x] 1.3 Tạo `apps/api/src/web-static/spa-fallback.middleware.ts`: với `GET/HEAD` + `Accept` chứa `text/html` + path KHÔNG reserved (`isReservedApplicationRoute` từ `@url-shortener/application` — tái sử dụng, không viết lại logic) ⇒ serve `index.html` với `Cache-Control: no-cache` + nosniff. Reserved path không match ⇒ next() (Nest 404 JSON cho `/api/*` unknown). Multi-segment non-reserved cũng fallback (AD-2).
  - [x] 1.4 Wire vào `AppModule.register(config)`: chỉ đăng ký 2 middleware khi `config.webDistDir` set; thứ tự static-assets → routes → spa-fallback (fallback là consumer cuối `forRoutes("*")`; health/api controllers vẫn thắng vì reserved check).
  - [x] 1.5 Unit + HTTP tests (`apps/api/src/web-static/web-static.test.ts`): deep route trả 200 HTML; `/assets/<file>` đúng content-type + immutable; `/api/unknown` trả 404 JSON không phải HTML; traversal (`/assets/..%2f..%2fpackage.json`, `/..%2f`) bị chặn; khi `WEB_DIST_DIR` unset ⇒ non-reserved route 404 (hành vi 1.1 giữ nguyên); headers nosniff.
  - [x] 1.6 Process-level test bổ sung `tests/api-process.test.ts`: spawn API với `WEB_DIST_DIR` trỏ dist thật (build sẵn từ pretest) — refresh `/dashboard` trả 200 HTML; sai `WEB_DIST_DIR` (thư mục không có index.html) ⇒ exit non-zero không leak giá trị.
- [x] Task 2: Session-gate seam và protected routes (AC: 1)
  - [x] 2.1 Tạo `apps/api/src/auth/session-placeholder.controller.ts`: `GET /api/auth/session` trả 401 RFC 9457 (`type`, `title`, `status: 401`, `code: "UNAUTHENTICATED"`) — đây là hành vi THẬT hiện tại (chưa tồn tại cơ chế session nào), không phải mock. Ghi chú trong code: Story 1.3 mount Better Auth `toNodeHandler` tại `/api/auth/*splat` TRƯỚC Nest routes và XÓA controller này. Test HTTP 401 + đúng problem shape + `Cache-Control: no-store`.
  - [x] 2.2 Mở rộng `packages/application/src/reserved-routes.ts`: thêm `/dashboard`, `/links`, `/account` vào `reservedExactRoutes`. Cập nhật bảng literal ĐỘC LẬP trong `tests/reserved-routes.test.ts` (bảng này cố ý không derive từ implementation — phải sửa cả hai phía).
  - [x] 2.3 Web: tạo `apps/web/src/routes/protected-layout.tsx` — layout route bọc `/dashboard`, `/links`, `/account`; loader `fetch("/api/auth/session", { credentials: "same-origin" })`; response không ok ⇒ `redirect("/sign-in?redirectTo=" + encodeURIComponent(pathname))` (preserve intended route per EXPERIENCE Session-expired). Render `AppShell` + `<Outlet/>`.
  - [x] 2.4 Tạo 3 route surfaces tối thiểu (`dashboard-page.tsx`, `links-page.tsx`, `account-page.tsx`): mỗi trang chỉ `document.title`, heading h1, `EmptyState` placeholder đúng voice EXPERIENCE (vd Links: "No short links yet." — nhưng KHÔNG có nút Create vì mutation thuộc Epic 2; dùng mô tả thay action).
  - [x] 2.5 Tests: unit loader redirect logic; e2e: goto `/dashboard` ⇒ URL kết thúc ở `/sign-in?redirectTo=%2Fdashboard`; initial GET `/dashboard` từ server trả 200 HTML (không 404) trước khi client redirect.
- [x] Task 3: Component foundation với DESIGN tokens (AC: 2)
  - [x] 3.1 Bổ sung tokens còn thiếu vào `apps/web/src/styles.css` (giữ tokens 1.1): `--accent: #0D366B` (active nav), `--success: #006300`, `--warning: #8A5700`, `--danger: #B42318`, `--ink-secondary: #52514E`, `--ink-muted: #64635F`, `--radius-sm: 6px`, `--radius-md: 8px`, `--radius-lg: 12px`, spacing unit 4px/card 24px/section 32px. Mở rộng `styles.test.ts` contrast checks cho token mới theo cách dùng thật (accent trên page/surface, danger text...).
  - [x] 3.2 `apps/web/src/components/app-shell.tsx`: landmark `<header>/<nav aria-label>/<main id="main-content" tabIndex={-1}>`; sidebar 232px desktop ≥1024px với `NavLink` Dashboard/Links/Account (react-router `NavLink` tự set `aria-current="page"` — one-active-nav); tablet 768–1023 sidebar thu gọn; <768px drawer: nút mở có accessible name, drawer đặt initial focus, focus trap, background `inert`, Escape đóng, focus return về trigger, tự đóng sau navigation; skip link tái sử dụng pattern 1.1; giữ `RouteAnnouncer` 1.1 cho route change announcement.
  - [x] 3.3 `primary-button.tsx`: bg `--primary`/fg trắng, radius md, min 44×44px, visible focus ring (token 1.1), props `disabled` (native + không tự ý `aria-disabled` kép) và `loading` (`aria-busy`, chặn double-activate, label tiến trình); một primary action mỗi surface là quy ước dùng, không enforce trong component.
  - [x] 3.4 `toast-banner.tsx`: non-blocking, `aria-live="polite"` region ổn định (region tồn tại trước khi message xuất hiện — tránh miss announcement), dedupe announcement, KHÔNG dùng cho blocking error (blocking dùng `role="alert"` inline — thuộc ErrorSummary consumer); auto-dismiss tôn trọng reduced-motion (không animation bắt buộc).
  - [x] 3.5 `dialog.tsx`: dựa native `<dialog>` + `showModal()` (focus containment/Escape/`::backdrop`/focus return là hành vi platform); expose `onClose`; destructive action tách khỏi cancel; không stack >1 modal; label bằng `aria-labelledby`.
  - [x] 3.6 `error-summary.tsx`: container `tabIndex={-1}` nhận focus khi render sau submit, heading + danh sách link `href="#field-id"` tới fields; consumer sở hữu `aria-invalid`/`aria-describedby` (Story 1.4+ dùng thật).
  - [x] 3.7 `empty-state.tsx`: icon-less label + mô tả + optional action slot; voice theo EXPERIENCE State Patterns.
  - [x] 3.8 FocusIndicator: utility class `.focus-indicator` trong styles.css (ring 2px `--primary` offset 2px, không bị overflow cắt) + export contract qua components (tài liệu hoá trong code comment ngắn); mọi component trên dùng chung utility này.
  - [x] 3.9 SSR markup contract tests (`apps/web/src/components/*.test.tsx`, dùng `renderToStaticMarkup` như pattern 1.1 — KHÔNG cài jsdom/@testing-library, deps mới cần user approval): semantics (landmarks, nav labels, aria-current đúng một item, dialog element, aria-live region, error-summary links, button disabled/aria-busy), token class usage. Mỗi file <200 dòng.
- [x] Task 4: Component harness cho behavioral contracts (AC: 2, 5)
  - [x] 4.1 Tạo `apps/web/component-harness/` (harness.html + harness-main.tsx + vite.harness.config.ts, output `apps/web/dist-harness/`): mount AppShell trong `createMemoryRouter` với 3 route giả lập active states, Dialog + trigger, Toast trigger, PrimaryButton loading toggle, ErrorSummary sample. Thêm script `build:harness: vite build --config vite.harness.config.ts` vào `apps/web/package.json`. Harness KHÔNG nằm trong production build (`vite build` mặc định không include); thêm assertion vào `tests/artifact-safety.test.ts`: production `apps/web/dist` không chứa `harness`.
  - [x] 4.2 Playwright project thứ hai trong `playwright.config.ts` (dùng mảng `webServer: [...]` — server 1: API host port 4173; server 2: harness `npm run build:harness --workspace=@url-shortener/web && vite preview --config vite.harness.config.ts --port 4174`): specs `tests/e2e/component-contracts.spec.ts`: drawer mở/initial focus/Escape đóng/focus return/đóng sau navigation; dialog Escape + focus return + backdrop; toast xuất hiện trong aria-live region; PrimaryButton 44×44 boundingBox + focus ring computed style + loading chặn double-click; one-active-nav: đúng một `[aria-current="page"]` và đổi theo navigation.
  - [x] 4.3 Giữ project e2e chính (auth-shell + shell smoke) chạy trên NestJS host (Task 5).
- [x] Task 5: CI gates, audit và responsive/keyboard smoke mở rộng (AC: 3, 4, 5)
  - [x] 5.1 `playwright.config.ts` webServer chính: build packages + web + api rồi chạy `node apps/api/dist/main.js` với `PORT=4173`, `WEB_DIST_DIR=apps/web/dist`, `DATABASE_URL` valid-shape unreachable (`postgres://test:test@127.0.0.1:9/test` — chứng minh luôn SPA serve được ở degraded DB mode; liveness 200/readiness 503 không ảnh hưởng static). Cập nhật `tests/build-with-sentinel.js` nếu cần cover harness build.
  - [x] 5.2 Mở rộng `tests/e2e/auth-shell.spec.ts` (hoặc tách `shell-smoke.spec.ts`): viewports 1280/800/375/320; refresh không 404 (`page.reload()` trên `/sign-in`, goto trực tiếp `/dashboard` nhận HTML 200 rồi client redirect); page title/landmarks/skip link/route announcement giữ pass; không 2D scroll ở mọi viewport + 200% text spacing (pattern 1.1).
  - [x] 5.3 Architecture gates: cập nhật `tests/architecture-boundaries.test.js` nếu allowlists cần (web vẫn chỉ `react|react-dom|react-router|@url-shortener/contracts`; api thêm import `node:fs`/`node:path` — Node builtin đã hợp lệ; không package mới). Chạy negative fixtures pass.
  - [x] 5.4 Audit gates giữ nguyên và mở rộng: `tests/toolchain.test.ts` (không dep mới ⇒ required map không đổi), `tests/artifact-safety.test.ts` thêm: API-served `index.html` + assets không chứa sentinel/`.env`; `dist-harness` không nằm trong web `dist`.
  - [x] 5.5 Chạy đủ: `npm run check` (verify:toolchain + typecheck + test + test:architecture + build) và `npm run test:e2e` (cả 2 Playwright projects) — tất cả pass, không skip để qua gate.

### Review Findings

- [x] [Review][Patch][High] Unhandled promise rejection in static middlewares can crash the API process on stream errors; client abort also leaks a forever-pending promise [apps/api/src/web-static/serve-static-file.ts:66]
- [x] [Review][Patch][Med] `/assets/..%2Findex.html` escapes the assets subtree and serves dist-root files with 1-year immutable cache; traversal tests need raw-HTTP vectors (undici normalizes `%2e%2e` client-side) [apps/api/src/web-static/static-assets.middleware.ts:34]
- [x] [Review][Patch][Med] SPA fallback hijacks controller routes via case/trailing-slash mismatch (`/Api/auth/session`, `/health/live/` get HTML) — Express 5 matches case-insensitively, classification compares case-sensitively [packages/application/src/reserved-routes.ts:27]
- [x] [Review][Patch][Med] Ambient `DATABASE_URL` leaks into the e2e API server and breaks the hard 503 readiness assertion [playwright.config.ts:33]
- [x] [Review][Patch][Med] ErrorSummary re-steals focus whenever the errors array identity changes (every keystroke in a controlled form) [apps/web/src/components/error-summary.tsx:16]
- [x] [Review][Patch][Med] AppShell layout has no 320px/zoom/text-spacing reflow evidence (AC5 gap — scroll assertions only run on auth pages) [tests/e2e/component-contracts.spec.ts:1]
- [x] [Review][Patch][Low] `redirectTo` drops query string; preserve pathname + search [apps/web/src/routes/session-loader.ts:16]
- [x] [Review][Patch][Low] Placeholder 401 ships `application/json` instead of RFC 9457 `application/problem+json` [apps/api/src/auth/session-placeholder.controller.ts:1]
- [x] [Review][Patch][Low] Bare `/health` is neither controller-owned nor reserved — allocator could mint short path `health`; use `/health` prefix [packages/application/src/reserved-routes.ts:9]
- [x] [Review][Patch][Low] SPA fallback responses lack `Vary: Accept` despite Accept-based content negotiation [apps/api/src/web-static/spa-fallback.middleware.ts:41]
- [x] [Review][Patch][Low] SSR test "exactly one active nav item" actually asserts 2 total; assert one per nav landmark [apps/web/src/components/app-shell.test.tsx:36]
- [x] [Review][Patch][Low] `Accept: */*`/missing-Accept fallback behavior (JSON 404) is intended but asserted nowhere [apps/api/src/web-static/web-static.test.ts:1]
- [x] [Review][Patch][Low] Toast tone is color-only (border) and placeholder copy uses dev vocabulary ("stories"); add hidden tone label + operational copy [apps/web/src/components/toast-banner.tsx:1]
- [x] [Review][Patch][Low] Drawer stays open (with hidden close control) when viewport grows past 768px; close on breakpoint change [apps/web/src/components/app-shell.tsx:33]
- [x] [Review][Patch][Low] Reconcile task 3.4/5.4 claims: prove API serves the scanned artifact bytes; record ToastBanner dedupe/auto-dismiss as parent-controlled design [tests/artifact-safety.test.ts:28]
- [x] [Review][Defer] No ETag/Last-Modified/304 or Range support — index.html `no-cache` has nothing to revalidate against [apps/api/src/web-static/serve-static-file.ts:57] — deferred, optimization beyond MVP SLO
- [x] [Review][Defer] Hardcoded ports 3196-3199 in process tests can flake under parallel runs; standalone run depends on prior build [tests/api-process.test.ts:14] — deferred, pre-existing suite pattern from Story 1.1
- [x] [Review][Defer] Static/SPA traffic is unlogged (RequestLoggerMiddleware scoped to health) — no visibility on asset 404s or traversal attempts [apps/api/src/app.module.ts:47] — deferred, observability scope of AD-16 story
- [x] [Review][Defer] Content-Length race when index.html is rewritten between stat and stream during deploys [apps/api/src/web-static/serve-static-file.ts:50] — deferred, deploy-time only; Render restarts process on deploy

## Dev Notes

### Previous story intelligence (Story 1.1 — 42 review patches đã hấp thụ)

- **TS7016/express types**: KHÔNG import type từ express; middleware dùng structural typing local (xem `request-logger.middleware.ts`). KHÔNG cài `@types/express`/`@nestjs/serve-static` — dep mới vi phạm toolchain gate và cần user approval (HALT).
- **ESM runtime**: mọi relative import trong emitted code có `.js`; packages export `dist/*.js` + `.d.ts`; `pretypecheck` build packages theo topo order — không đổi cấu trúc script.
- **Reserved routes**: `tests/reserved-routes.test.ts` dùng bảng literal độc lập — thêm route mới phải sửa CẢ registry và bảng test, đây là chủ đích chống drift.
- **Architecture checker**: AST-based, fail-closed khi thiếu root, có negative fixtures — file mới tự động được quét; đừng đặt file sai workspace.
- **Playwright**: `forbidOnly` trên CI; Windows 10 local KHÔNG phải acceptance environment (project-context) — evidence từ CI/Linux; local chạy để dev nhanh, kết luận từ CI. Local dev dùng `npm_config_engine_strict=false` prefix (Node local 22.16.0 < 22.22.0).
- **Logging/config**: fail-fast không in giá trị env; logger tự sanitize (đã có scrubber đầy đủ) — dùng `createLogger` từ observability, không `console.log`.
- **CRLF**: tests assert text dùng regex/`.gitattributes` LF đã chuẩn hoá — tránh literal `\n` matching.
- **CI**: `npm ci --ignore-scripts` + `npm audit signatures`; PostgreSQL 18 service có sẵn (`INTEGRATION_DATABASE_URL`); pretest build sentinel — build với `STORY_TEST_PRIVATE_SENTINEL` rồi artifact scan.

### Architecture guardrails (authority: ARCHITECTURE-SPINE)

- **AD-2**: một public origin; NestJS serve React build; reserved registry xử lý trước; multi-segment non-reserved fallback SPA. Root one-segment sẽ check `short_path_registry` trước fallback — registry CHƯA tồn tại (Epic 2); Story 1.2 fallback mọi non-reserved path và precedence động thuộc Story 3.1. KHÔNG dựng registry stub.
- **AD-9**: Better Auth là auth owner duy nhất. Controller `/api/auth/session` 401 của story này là seam tạm — 1.3 mount `toNodeHandler(auth)` tại `/api/auth/*splat` trước JSON parsers và xoá controller. KHÔNG tạo session store/guard định nghĩa identity.
- **AD-1**: web chỉ import generated contracts (chưa có — 1.3); web KHÔNG gọi API bằng hand-written client ngoài fetch session-gate tạm này (ghi chú: 1.3 chuyển sang generated client).
- **AD-16**: structured logs correlation ID đã có qua RequestLoggerMiddleware — static/fallback requests cũng đi qua (forRoutes hiện là "health"; cân nhắc mở rộng logging scope nhưng KHÔNG log path của static asset ở level gây noise; giữ nguyên "health" scope là chấp nhận được cho story này).
- Headers: story này chỉ thêm `X-Content-Type-Options: nosniff` + cache policy; CSP/HSTS/cookie policy đầy đủ thuộc 1.3 khi auth origin quyết định (đừng claim security review hoàn tất).

### UX contracts (authority: DESIGN.md tokens, EXPERIENCE.md behavior)

- Breakpoints: ≥1024 sidebar cố định 232px; 768–1023 thu gọn; <768 drawer. Content max 1280px.
- Nav: Dashboard, Links, Account — one active item; drawer đóng sau navigation; preserve route khi refresh.
- Màu: `--primary #1C5CAB` action/link/focus; `--accent #0D366B` active nav; status colors luôn kèm icon/label; `--interactive-text #0d4f99` đã dùng cho link AA (giữ từ 1.1).
- Shapes: input/button radius sm/md; card lg; pill chỉ cho badge; focus ring không bị overflow cắt.
- Không gradient/glassmorphism/decoration; hover không layout shift; tôn trọng `prefers-reduced-motion` (block CSS 1.1 đã có).
- Voice: "No short links yet." / trực tiếp, calm, không hype. Auth surfaces vẫn không có form controls (1.4+).
- 44×44px targets; tooltips chỉ enhancement; `<tr>` không bao giờ là control (áp dụng từ Epic 2, ghi để không vi phạm sớm).

### Kỹ thuật cụ thể

- Static middleware tự viết: containment check bằng `path.resolve` + `startsWith(distRoot + sep)`; decode URI một lần, reject `%00`; chỉ GET/HEAD; stream bằng `createReadStream` pipe, handle ENOENT ⇒ next().
- **Express 5/Nest 11 wildcard**: unnamed `*` KHÔNG hợp lệ (path-to-regexp v8 — 1.1 dev note). Catch-all middleware dùng `forRoutes({ path: "{*splat}", method: RequestMethod.ALL })` (import `RequestMethod` value, `type MiddlewareConsumer`). Nest middleware chạy TRƯỚC route handlers trên path match — vì vậy SPA fallback bắt buộc `next()` cho mọi reserved path để health/api controllers xử lý.
- `NestFactory.create(AppModule.register(config), { logger: false })` giữ nguyên; middleware đăng ký qua `MiddlewareConsumer` trong AppModule (pattern 1.1), dùng `type MiddlewareConsumer` import (verbatimModuleSyntax).
- React Router 8: `NavLink` từ `react-router`; `redirect` từ `react-router`; loader trong `createBrowserRouter` config (`router.tsx` mở rộng, giữ lazy-free structure 1.1).
- Native `<dialog>`: `showModal()` cho modal semantics; focus return là platform behavior — test ở harness, không cần polyfill.
- Harness không được lọt production: build riêng `--config vite.harness.config.ts` output `dist-harness/`; artifact-safety assert.
- Giữ mỗi file <200 dòng — AppShell có thể tách `app-shell-drawer.tsx` nếu vượt.

### Project Structure Notes

- Files MỚI: `apps/api/src/web-static/{static-assets.middleware.ts,spa-fallback.middleware.ts,web-static.test.ts}`, `apps/api/src/auth/session-placeholder.controller.ts(+test)`, `apps/web/src/components/{app-shell,primary-button,toast-banner,dialog,error-summary,empty-state}.tsx(+tests)`, `apps/web/src/routes/{protected-layout,dashboard-page,links-page,account-page}.tsx`, `apps/web/component-harness/*`, `apps/web/vite.harness.config.ts`, `tests/e2e/component-contracts.spec.ts`.
- Files UPDATE: `apps/api/src/config.ts` (+test), `apps/api/src/app.module.ts`, `packages/application/src/reserved-routes.ts`, `apps/web/src/router.tsx`, `apps/web/src/styles.css` (+styles.test.ts), `tests/reserved-routes.test.ts`, `tests/api-process.test.ts`, `tests/artifact-safety.test.ts`, `tests/e2e/auth-shell.spec.ts`, `playwright.config.ts`, có thể `tests/build-with-sentinel.js`, `tests/architecture-boundaries.test.js`.
- Không file nào bị xoá. Không dependency mới (mọi dep mới ⇒ HALT xin approval).
- Hiện trạng cần giữ: `apps/api/src/main.ts` (7 dòng), health module, readiness probe lifecycle, RouteAnnouncer, auth-page semantics — chỉ mở rộng, không viết lại.

## Testing Requirements

- `npm run check` pass đầy đủ: verify:toolchain, typecheck, unit/integration (Vitest), architecture (negative fixtures), production build.
- `npm run test:e2e` pass cả 2 projects: shell smoke trên NestJS host (port 4173, degraded DB) và component contracts trên harness.
- Web-static tests phải chứng minh: deep-route refresh 200 HTML, `/api/*` unknown 404 JSON, traversal bị chặn, unset `WEB_DIST_DIR` giữ hành vi 1.1, đúng cache/nosniff headers.
- Session-gate tests: 401 problem shape; client redirect preserve `redirectTo`; server GET `/dashboard` không 404.
- Component contracts: SSR semantics (Vitest) + behavior (Playwright harness): drawer initial-focus/Escape/focus-return/close-on-nav, dialog lifecycle, toast aria-live, 44×44 targets, focus ring computed style, one-active-nav duy nhất.
- Không dùng jsdom/@testing-library/mocks cho DB/session; không skip/nới test để qua gate; Playwright acceptance evidence từ CI/Linux.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.2: Xác thực application shell và CI boundaries`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md#AD-2 — One public origin with reserved route precedence`]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-9 — Authentication has one owner`]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-19 — Architecture evidence is reproducible`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-url_shortener_system-2026-07-19/DESIGN.md#Layout & Spacing`, `#Components`, frontmatter tokens]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md#Component Patterns`, `#Accessibility Floor`, `#Responsive & Platform`, `#State Patterns`]
- [Source: `_bmad-output/project-context.md#Critical Implementation Rules`, `#Testing Rules`]
- [Source: `_bmad-output/implementation-artifacts/1-1-khoi-tao-secure-application-shell.md#Dev Notes`, `#Review Findings`]
- [Source: `https://docs.nestjs.com/middleware`]
- [Source: `https://reactrouter.com/api/components/NavLink`]
- [Source: `https://developer.mozilla.org/docs/Web/HTML/Element/dialog`]
- [Source: `https://developer.mozilla.org/docs/Web/API/HTMLElement/inert`]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code)

### Debug Log References

- Adding `/dashboard`, `/links`, `/account` to `reservedExactRoutes` initially broke SPA fallback (reserved ⇒ fallback skipped ⇒ 404). Resolved by splitting route classification: `isReservedApplicationRoute` (short-path namespace protection, unchanged semantics) vs `isControllerOwnedRoute` (api/health/assets only) — SPA fallback now keys off controller ownership, so `/sign-in` and protected routes serve the SPA document on the API host.

### Completion Notes List

- Same-origin NestJS production host: self-owned static pipeline (`serve-static-file.ts` + 2 middleware, structural typing, no new deps) serving `/assets` immutable + SPA fallback no-cache with nosniff, path containment chặn traversal, `{*splat}` Express 5 catch-all; `WEB_DIST_DIR` optional fail-fast config không leak giá trị; API-only mode 1.1 giữ nguyên khi unset.
- Session-gate seam: `GET /api/auth/session` trả 401 RFC 9457 no-store (hành vi thật — chưa có session mechanism; Story 1.3 thay bằng Better Auth mount); web `createSessionLoader` fail-closed redirect `/sign-in?redirectTo=...` với credentials same-origin; protected routes `/dashboard`, `/links`, `/account` qua `ProtectedLayout` + AppShell.
- Component foundation: AppShell (sidebar 232px/200px tablet, native-dialog drawer mobile với platform focus trap/Escape/focus-return, đóng sau navigation, one-active-nav qua NavLink aria-current, RouteAnnouncer), PrimaryButton (44×44, disabled/aria-busy loading chặn double-activate), ToastBanner (stable polite region), Dialog (native dialog + labelledby), ErrorSummary (focused, linked fields), EmptyState, `.focus-indicator` utility; DESIGN tokens đầy đủ với AA contrast checks theo cách dùng thật.
- Component harness (`apps/web/component-harness`, build riêng `dist-harness/`, gitignored, artifact-safety xác nhận không lọt production dist) + Playwright project `components` (port 4174) cho behavioral contracts; project `shell` (port 4173) chạy trên NestJS host với DB unreachable chứng minh degraded-mode serving.
- Validation cuối: `npm run check` pass (88 unit/integration + 1 PostgreSQL skip local, architecture negative fixtures, production build), Playwright 20/20 (2 projects), `npm ci --ignore-scripts --dry-run` sạch, `git diff --check` sạch. Local chạy Node 22.16.0 với engine override đã ghi nhận; acceptance evidence từ CI/Linux.

### File List

- NEW: `apps/api/src/web-static/serve-static-file.ts`, `apps/api/src/web-static/static-assets.middleware.ts`, `apps/api/src/web-static/spa-fallback.middleware.ts`, `apps/api/src/web-static/web-static.test.ts`
- NEW: `apps/api/src/auth/session-placeholder.controller.ts`, `apps/api/src/auth/session-placeholder.controller.test.ts`
- NEW: `apps/web/src/components/app-shell.tsx`, `app-shell.test.tsx`, `primary-button.tsx`, `toast-banner.tsx`, `dialog.tsx`, `error-summary.tsx`, `empty-state.tsx`, `foundation-controls.test.tsx`
- NEW: `apps/web/src/routes/protected-layout.tsx`, `session-loader.ts`, `session-loader.test.ts`, `dashboard-page.tsx`, `links-page.tsx`, `account-page.tsx`
- NEW: `apps/web/component-harness/harness.html`, `apps/web/component-harness/harness-main.tsx`, `apps/web/vite.harness.config.ts`
- NEW: `tests/e2e/shell-smoke.spec.ts`, `tests/e2e/component-contracts.spec.ts`
- UPDATE: `apps/api/src/config.ts`, `apps/api/src/config.test.ts`, `apps/api/src/app.module.ts`
- UPDATE: `packages/application/src/reserved-routes.ts`, `packages/application/src/index.ts`
- UPDATE: `apps/web/src/router.tsx`, `apps/web/src/styles.css`, `apps/web/src/styles.test.ts`, `apps/web/package.json`
- UPDATE: `tests/reserved-routes.test.ts`, `tests/api-process.test.ts`, `tests/artifact-safety.test.ts`, `tests/e2e/auth-shell.spec.ts`, `playwright.config.ts`, `.gitignore`
- Story artifacts: `_bmad-output/implementation-artifacts/1-2-xac-thuc-application-shell-va-ci-boundaries.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-07-26: Addressed code review findings — 15 patches resolved (middleware crash-safety and abort settlement, assets-subtree containment with raw-HTTP traversal vectors, case/trailing-slash route normalization, e2e DATABASE_URL isolation, ErrorSummary focus signature, AppShell reflow evidence, redirectTo query preservation, problem+json media type, /health prefix reservation, Vary: Accept, per-nav active assertion, */* accept contract, toast tone labels + operational copy, drawer breakpoint close, artifact parity assertion), 4 deferred, 2 dismissed. Review complete; story done.
- 2026-07-26: Implemented Story 1.2 — same-origin NestJS SPA host, session-gate seam with protected routes, 7-component foundation with DESIGN tokens, component harness behavioral contracts, expanded CI/e2e gates. All ACs validated (88 unit + 20 e2e pass).
