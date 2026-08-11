---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - prds/prd-url_shortener_system-2026-07-19/prd.md
  - architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md
  - ux-designs/ux-url_shortener_system-2026-07-19/DESIGN.md
  - ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md
---

# URL Shortener System - Epic Breakdown

## Overview

Tài liệu này cung cấp phân rã epic và story đầy đủ cho URL Shortener System, dựa trên PRD, UX design contract và architecture spine đã được duyệt.

## Requirements Inventory

### Functional Requirements

FR-1: Marketer có thể đăng ký và đăng nhập bằng email/password; email phải được xác minh trước khi tài khoản hoạt động, lỗi đăng nhập không tiết lộ tài khoản tồn tại.

FR-2: Marketer có thể đăng nhập bằng Google OAuth; account collision không tạo tài khoản trùng hoặc tự động merge và chỉ được liên kết sau verified-email re-authentication.

FR-3: Marketer có authenticated session để xem/quản lý dữ liệu của mình, đăng xuất được, bị yêu cầu đăng nhập lại khi session hết hạn, và không thể truy cập link của marketer khác.

FR-4: Marketer có thể tạo Short Link từ Destination URL `http`/`https`; hệ thống sinh Code khi không nhập Alias và hiển thị link mới trong danh sách.

FR-5: Marketer có thể tạo Alias tùy chỉnh global, lowercase, dài 3–64 ký tự, chỉ gồm `a-z`, `0-9`, `-`, không có hyphen đầu/cuối và không trùng Code, Reserved Path hoặc Tombstone.

FR-6: Marketer có thể xem danh sách Short Link của mình với short path, destination URL, ngày tạo và tổng click.

FR-7: Marketer có thể sửa Destination URL của Short Link mình sở hữu; short path và historical analytics không đổi, URL mới phải qua validation.

FR-8: Marketer có thể xóa Short Link mình sở hữu; link biến mất khỏi dashboard, public path trả 404, path được tombstone vĩnh viễn và aggregate lịch sử bị ẩn.

FR-9: Hệ thống rate-limit thao tác tạo Short Link theo tài khoản; vượt ngưỡng trả HTTP 429, `Retry-After`, không tạo dữ liệu mới.

FR-10: Visitor có thể mở `/{Code}` hoặc `/{Alias}` active và nhận HTTP 302 tới Destination URL hiện tại; path missing/deleted trả 404, redirect không yêu cầu đăng nhập.

FR-11: Mỗi human redirect hợp lệ tạo đúng một durable Click Event có UUID, UTC timestamp, effective UTM snapshot và derived dimensions; bot/link preview không được đếm; retry/worker không double-count; thiếu enrichment dùng `unknown`.

FR-12: Marketer có thể dùng UTM builder cho `utm_source`, `utm_medium`, `utm_campaign`, xem final URL preview, giữ UTM khi redirect, nhận non-blocking casing/space warning, thay thế duplicate UTM keys và giữ query/fragment khác.

FR-13: Marketer có thể xem tổng click của từng Short Link trên danh sách và detail.

FR-14: Marketer có thể xem click theo ngày UTC, default 30 ngày và zero-filled dates.

FR-15: Marketer có thể breakdown/filter bằng AND theo referrer, country, city, device, browser và ba UTM dimensions; historical UTM snapshot bất biến, location là estimated, missing data là `unknown`, raw IP không hiển thị.

FR-16: Marketer có thể refresh analytics theo request mà giữ nguyên filter/context; click xuất hiện trong tối đa 60 giây; dashboard hiển thị `Last updated` và freshness warning.

### NonFunctional Requirements

NFR-1: Redirect p95 ≤200 ms ở 100 request/giây, 20 concurrent connections, chạy 10 phút; analytics aggregation không chạy trên request path.

NFR-2: Dashboard analytics p95 ≤2 giây với 100.000 events/facts trong range 30 ngày và 20 concurrent requests sau warm-up.

NFR-3: Click hợp lệ xuất hiện trong analytics ≤60 giây trong declared load envelope.

NFR-4: Dashboard/link management yêu cầu session cookie `HttpOnly`, `Secure`, `SameSite=Lax` trong production.

NFR-5: Password dùng secure password hashing; không lưu plaintext hoặc reversible encryption.

NFR-6: Login có PostgreSQL-backed rate limit, generic errors và không account enumeration.

NFR-7: Unsafe browser mutations chỉ chấp nhận exact same-origin `Origin` và `Sec-Fetch-Site: same-origin`; mismatch/missing trả 403, không mutation.

NFR-8: Destination URL chỉ nhận `http`/`https`; unsafe/malformed URL bị từ chối.

NFR-9: Global Short Path Namespace chặn reserved paths, collision, noncanonical input và permanent reuse sau delete bằng DB constraints.

NFR-10: Google OAuth kiểm tra `state`/OIDC `nonce`; account linking yêu cầu verified email và fresh re-authentication.

NFR-11: Analytics aggregate-first, không cross-site profiling; retained dimensions được bound/normalize để tránh PII/high-cardinality leakage.

NFR-12: Raw/dead-letter Click Events xóa trong 30 ngày; daily aggregate facts và processed-event idempotency ledger được giữ theo architecture; aggregate deleted links bị ẩn.

NFR-13: Dashboard không hiển thị raw IP; application/proxy logs cũng không lưu raw IP hoặc secrets.

NFR-14: City-level location được ghi nhãn estimated; enrichment failure dùng `unknown`.

NFR-15: Redirect không thất bại do lỗi local parsing/enrichment; DB lookup hoặc durable event commit failure trả 503, không redirect.

NFR-16: Deleted/tombstoned paths trả 404 và không redirect tới destination cũ.

### Additional Requirements

- Bootstrap monorepo với `apps/web`, `apps/api`, `apps/worker`, `packages/application`, `packages/domain`, `packages/db`, `packages/contracts`, `packages/observability`.
- Dùng same-origin React SPA + NestJS backend + PostgreSQL worker; web/API và worker deploy độc lập trên Render Singapore, PostgreSQL cùng region/private network.
- Pin Node >=22.22.0, React/React DOM 19.2.7, React Router 8.2.0, Vite 8.1.5, NestJS 11.1.28, Drizzle 0.45.2, Drizzle Kit 0.31.10, Better Auth 1.6.23, PostgreSQL 18.x, ECharts 6.1.0, Vitest 4.1.10, Playwright 1.61.1.
- Thiết lập workspace dependency boundaries, ESLint restricted imports và architecture tests: domain không import framework/adapters; worker không import controllers.
- NestJS DTO/runtime validation sở hữu OpenAPI; CI sinh `packages/contracts`, fail nếu generated diff chưa commit.
- Better Auth chạy ESM; bootstrap Nest với `bodyParser: false`, mount Express 5 `/api/auth/*splat` official handler trước JSON/urlencoded parser; bắt buộc integration spike/test.
- Better Auth schema/migrations được nhập vào Drizzle migration chain; canonical Better Auth user ID, ActorId và owner FK dùng string.
- Một `short_path_registry` table sở hữu namespace vĩnh viễn với UNIQUE canonical path, lifecycle CHECK `active|tombstoned`, reserved registry và bounded generated-Code collision retry.
- Route precedence: fixed reserved prefixes trước, exact one-segment path lookup trước SPA fallback; CI/deploy chặn root route collision với active/tombstoned registry.
- PostgreSQL là redirect source of truth; chưa dùng Redis cache. HTTP 302 + `Cache-Control: no-store`; DB lookup/event commit failure trả 503.
- Durable Click Event insert xảy ra trước human redirect response; raw IP không persisted; local bot/GeoIP/UA adapters có pinned data, bounded lookup và trusted proxy chain.
- PostgreSQL Click Event rows là work queue với states `pending|leased|processed|dead_letter`, DB-clock lease token fencing, `FOR UPDATE SKIP LOCKED`, exponential retry tối đa 5 attempts, optional LISTEN/NOTIFY + mandatory polling.
- Processed-event ledger dùng globally unique UUID; worker phải acquire marker bằng `INSERT ... ON CONFLICT DO NOTHING RETURNING` trước fact UPSERT; ledger không cascade theo raw event.
- Daily dimensional fact dùng typed non-null columns và composite UNIQUE key cho day/link/all dimensions; normalized referrer host, bounded UTM/enums, canonical `unknown`.
- Create-link dùng owner-scoped idempotency key; edit/delete dùng expected version để phục hồi timeout mà không duplicate mutation.
- Application UnitOfWork cung cấp transaction-scoped repositories; namespace/link mutation và aggregate/event-state transition commit atomically.
- PostgreSQL-backed fixed-window rate limit cho login và create-link; 429 + Retry-After; operator denylist có thể disable malicious link.
- Better Auth token state + email adapter port xử lý verification email ngoài DB transaction, với resend cooldown, bounded retry và secret-free logs.
- Structured RFC 9457-style API errors: `type`, `title`, `status`, `detail`, `instance`, optional `code`, `fieldErrors`.
- Structured JSON logging với request/event correlation ID; không log raw IP, password, token, cookie, full destination query hoặc verification secret.
- Health/readiness, worker heartbeat, latency histograms, queue age/lag, retry/dead-letter, DB pool saturation và alerts cho SLO/freshness.
- Drizzle migrations forward-only theo expand/migrate/contract, advisory lock, N/N-1 compatibility, schema readiness check và migration failure blocks cutover.
- Retention job singleton/leased, chunk delete, metric `oldest_raw_event_age`; backup/PITR và restore drill trước production marketing use.
- CI bắt buộc auth bootstrap test, CSRF acceptance/rejection, architecture boundary test, OpenAPI diff, migration lint, namespace concurrency, E2E và declared load benchmarks.
- Playwright acceptance chạy trên supported CI/Linux, WSL hoặc Windows 11; Windows 10 local không phải acceptance environment.

### UX Design Requirements

UX-DR1: Implement Calm Analytics light-mode token system chính xác từ DESIGN.md: semantic colors, typography, 4px spacing unit, 6/8/12px radii và 2px focus ring.

UX-DR2: Implement responsive app shell với Dashboard, Links, Account; sidebar ≥1024px, collapsed tablet 768–1023px, drawer <768px.

UX-DR3: Implement Sign in/Sign up surface cho email/password và Google, password manager/autocomplete/paste/reveal, generic errors, loading/network states.

UX-DR4: Implement Email verification states: pending, resend cooldown, expired/failed token, verified success và back-to-sign-in.

UX-DR5: Implement Account linking flow: collision explanation, email/password sign-in, Account → Link Google, re-authenticate, confirm identity, success/cancel/failure.

UX-DR6: Implement Dashboard overview với KPI summary, recent links, daily trend, breakdown, Last updated/freshness/estimated/unknown labels.

UX-DR7: Implement Links surface với search/no-results, short-path native links, owned-link metadata, native checkbox multi-select và actions không biến `<tr>` thành control.

UX-DR8: Implement Create/Edit form với visible labels, destination validation, alias helper/errors, collapsible UTM builder, live final URL preview, non-blocking warning và idempotent timeout reconciliation.

UX-DR9: Implement Link detail với copy action/fallback, metadata, total/day/breakdown analytics, Edit/Delete actions và explicit View analytics success path.

UX-DR10: Implement Compare Links cho 2–5 owned links, shared date/filter state, stable series identity, side-by-side KPI/trend/breakdowns và stacked mobile layout.

UX-DR11: Implement filter bar với Today/7/30/90/custom presets và dimensions referrer/country/city/device/browser/three UTM fields; AND semantics, active-count mobile drawer, context preserved on refresh.

UX-DR12: Implement accessible analytics charts: line for trend, horizontal bars for breakdown, direct labels, fixed palette order, `Other` after 8 series, adjacent captioned data-table fallback và no essential tooltip-only information.

UX-DR13: Implement chart/table states: skeleton without layout shift, empty analytics, zero-filled dates, `unknown`, refresh loading with previous data retained, refresh failure/retry và freshness delay.

UX-DR14: Implement Delete confirmation dialog with 404/permanent-tombstone consequence; success returns Links/removes row; failure retains dialog/context and retry.

UX-DR15: Implement public redirect without app chrome và minimal public 404 “Link not found” with no external redirect.

UX-DR16: Implement reusable AppShell, PrimaryButton, MetricCard, FilterBar, ChartCard, LinkTable, Toast/Banner, Dialog, ErrorSummary, EmptyState và FocusIndicator per visual/behavioral contracts.

UX-DR17: Meet WCAG 2.2 AA target: semantic landmarks/headings/skip link/page title, route-change announcement, full keyboard operation, native controls, 44×44 targets và no color-only information.

UX-DR18: Implement accessible forms/errors: validation on blur/submit, operable submit, focused linked error summary, `aria-invalid`, `aria-describedby`, preserved input và blocking `role=alert` only.

UX-DR19: Implement modal/drawer/popover lifecycle: initial focus, modal containment, inert background, Escape/close, focus return và focused content never obscured.

UX-DR20: Implement live feedback: `aria-live=polite` for create/copy/refresh, deduplicated announcements, clipboard failure fallback và no toast-only critical error.

UX-DR21: Respect `prefers-reduced-motion`; no comprehension depends on animation; only meaningful, non-layout-shifting transitions.

UX-DR22: Support reflow at 320 CSS px/400% zoom and 200% text spacing; only labeled data tables may scroll horizontally; mobile controls/actions remain visible.

UX-DR23: Implement design token contrast and chart identity rules: status color always paired with icon/label; chart series never reuse status semantics; low-contrast marks require direct labels/table.

UX-DR24: Use provided key-screen references `mockups/dashboard-analytics.html` and `mockups/create-link.html`; DESIGN.md/EXPERIENCE.md always win on conflict.

### FR Coverage Map

FR-1 → Epic 1: Email/password registration and verification
FR-2 → Epic 1: Google OAuth and safe account linking
FR-3 → Epic 1: Session and ownership access
FR-4 → Epic 2: Create Short Link
FR-5 → Epic 2: Custom Alias and namespace validation
FR-6 → Epic 2: Owned link list
FR-7 → Epic 2: Edit Destination URL
FR-8 → Epic 2: Delete, 404 and Tombstone
FR-9 → Epic 2: Link-creation rate limit
FR-10 → Epic 3: Public redirect
FR-11 → Epic 3: Durable Click Event capture
FR-12 → Epic 2: UTM builder
FR-13 → Epic 4: Total click analytics
FR-14 → Epic 4: Daily analytics
FR-15 → Epic 4: Dimension breakdowns and filters
FR-16 → Epic 4: Request-based refresh and freshness

NFRs and UX-DRs are cross-cutting. Each story must reference applicable NFR/UX-DR acceptance criteria; no technical-only epic is created.

## Epic List

### Epic 1: Secure marketer workspace

**User outcome:** Marketer creates an account, verifies email, signs in with email/password or Google, and only accesses links owned by their account.

**FRs covered:** FR-1, FR-2, FR-3

**Implementation notes:** Bootstrap the monorepo, NestJS, React Router, Better Auth and Drizzle. Include Google collision/linking, session/logout/expiry, CSRF, security headers, login rate limiting, email verification and accessible auth states. Covers NFR-4–NFR-7 and NFR-10.

### Epic 2: Create and manage campaign links

**User outcome:** Marketer creates readable Short Links, configures UTM, lists links, edits destinations and deletes links safely.

**FRs covered:** FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-12

**Implementation notes:** Implement the global `short_path_registry`, Alias validation, reserved paths, Tombstone, generated Code allocator, `http`/`https` validation, UTM composition/preview, owner-scoped create idempotency, edit/delete expected version and PostgreSQL-backed creation rate limit. Implement Create Link, Links, Link detail, Edit and Delete UX.

### Epic 3: Reliable public sharing and click capture

**User outcome:** Visitor opens a Short Link and receives the correct redirect; the system captures reliable click data without exposing sensitive data.

**FRs covered:** FR-10, FR-11

**Implementation notes:** Implement root route precedence, public 404, indexed PostgreSQL lookup, HTTP `302` with `Cache-Control: no-store`, durable Click Event before redirect, `503` on lookup/event commit failure, bot/link-preview exclusion, derived GeoIP/UA/referrer fields, `unknown` fallback, no raw IP, PostgreSQL queue, lease fencing, retries, dead-letter and idempotency ledger. Covers NFR-1, NFR-3, NFR-8 and NFR-11–NFR-16.

### Epic 4: Campaign analytics and optimization

**User outcome:** Marketer identifies stronger campaigns, compares 2–5 links and adjusts channel/content using analytics.

**FRs covered:** FR-13, FR-14, FR-15, FR-16

**Implementation notes:** Implement daily dimensional facts with composite uniqueness, total/UTC-day/referrer/country/city/device/browser/UTM analytics, Compare Links with shared AND filters, request refresh and ≤60-second freshness. Implement KPI, trend, breakdown, table fallback, `unknown`, `estimated`, responsive and WCAG 2.2 AA analytics UX. Covers NFR-2 and related UX-DRs.

### Epic Dependencies

Epic 1 → Epic 2 → Epic 3 → Epic 4. Epic 2 depends on Epic 1 identity/ownership; Epic 3 depends on Short Link/Destination URL from Epic 2; Epic 4 depends on Click Events from Epic 3. Each epic delivers a complete user-value slice once its prerequisites exist.

## Epic 1: Secure marketer workspace

Marketer có thể truy cập ứng dụng, xác minh tài khoản, đăng nhập an toàn và quản lý các phương thức đăng nhập.

### Story 1.1: Khởi tạo secure application shell

**Requirements:** FR-1, FR-2, FR-3
Là một marketer,
Tôi muốn truy cập được giao diện đăng nhập trên một nền ứng dụng an toàn,
Để tôi có điểm vào ổn định cho các chức năng tài khoản và campaign sau này.

**Acceptance Criteria:**

**Given** repository chưa có application runtime
**When** workspace được bootstrap
**Then** monorepo chứa `apps/web`, `apps/api`, `apps/worker`, `packages/application`, `packages/domain`, `packages/db`, `packages/contracts`, `packages/observability`
**And** dùng Node `>=22.22.0`, React/React DOM `19.2.7`, React Router `8.2.0`, Vite `8.1.5`, NestJS `11.1.28`, Drizzle `0.45.2` và Better Auth `1.6.23`.

**Given** các package đã được tạo
**When** architecture checks chạy
**Then** `packages/domain` không được import React, NestJS, Drizzle hoặc Better Auth
**And** `apps/worker` không được import HTTP controllers
**And** vi phạm dependency boundary làm CI thất bại.

**Given** marketer mở ứng dụng trên desktop hoặc mobile
**When** public application route được tải
**Then** Sign in/Sign up surface hiển thị bằng responsive app shell
**And** dùng token từ `DESIGN.md`
**And** có semantic landmarks, page title, skip link và visible focus ring
**And** hoạt động tại 320 CSS px mà không xuất hiện cuộn hai chiều.

**Given** PostgreSQL không khả dụng
**When** readiness endpoint được gọi
**Then** readiness báo unavailable
**And** liveness vẫn phản ánh process còn sống
**And** lỗi kết nối không làm lộ credentials hoặc secrets trong log.

### Story 1.2: Xác thực application shell và CI boundaries

**Requirements:** FR-1, FR-2, FR-3
Là một builder,
Tôi muốn application shell và package boundaries có executable checks,
Để foundation không drift khi các feature được triển khai độc lập.

**Acceptance Criteria:**

**Given** web application khởi động
**When** smoke test tải public auth route và protected route
**Then** static SPA assets được serve same-origin bởi NestJS production host
**And** browser route refresh không trả 404
**And** protected route yêu cầu session trước khi hiển thị dữ liệu.

**Given** reusable UI foundation được tạo
**When** component contract tests chạy
**Then** `AppShell`, `PrimaryButton`, `Toast/Banner`, `Dialog`, `ErrorSummary`, `EmptyState` và `FocusIndicator` dùng shared DESIGN tokens và behavior contract
**And** controls có visible focus, disabled/loading semantics và target tối thiểu 44×44px
**And** feature stories mở rộng foundation thay vì tạo duplicate component khác semantics.

**Given** source code được kiểm tra trước merge
**When** CI chạy
**Then** typecheck, unit test, production build và architecture boundary test đều pass
**And** `packages/domain` không import framework/adapters
**And** `apps/worker` không import HTTP controllers.

**Given** production build được tạo
**When** dependency/runtime audit chạy
**Then** exact package versions và Node engine khớp architecture seed
**And** lockfile không có unresolved drift
**And** build artifact không chứa development secrets hoặc source `.env`.

**Given** layout được kiểm tra tại desktop, tablet, mobile, 320 CSS px và 400% zoom
**When** keyboard smoke test chạy
**Then** skip link, landmarks, page title, route announcement, drawer Escape/focus return và one-active-nav contract đều pass
**And** không có two-dimensional page scroll ngoài labeled data-table region.

### Story 1.3: Tích hợp Better Auth và generated API contracts

**Requirements:** FR-1, FR-2, FR-3
Là một marketer,
Tôi muốn authentication và API client dùng một integration contract đã kiểm chứng,
Để đăng nhập và các chức năng sau không lệch giữa web và API.

**Acceptance Criteria:**

**Given** NestJS API khởi động
**When** Better Auth được tích hợp
**Then** API chạy ESM và khởi tạo Nest với `bodyParser: false`
**And** official Better Auth Node handler được mount tại `/api/auth/*splat` trước JSON/urlencoded parsers
**And** không dùng community Nest wrapper hoặc session store thứ hai.

**Given** Better Auth schema được tạo
**When** database migrations được chuẩn bị
**Then** auth schema/migrations được import vào cùng Drizzle migration chain
**And** canonical Better Auth user ID, application `ActorId` và owner FK đều dùng string
**And** migration test từ database rỗng phải pass.

**Given** integration test gọi Better Auth bằng JSON
**When** auth handler xử lý request
**Then** request không treo
**And** session cookie được phát hành
**And** protected Nest endpoint resolve cùng canonical session/ActorId
**And** test thất bại nếu middleware ordering bị thay đổi sai.

**Given** NestJS DTO là API contract source of truth
**When** OpenAPI generation chạy
**Then** generated client/types được ghi vào `packages/contracts`
**And** `apps/web` chỉ dùng generated contract để gọi API
**And** CI thất bại nếu generated output khác nội dung đã commit.

**Given** generated browser client gọi unsafe mutation
**When** request được gửi same-origin
**Then** credentials được gửi theo contract
**And** valid `Origin`/`Sec-Fetch-Site` được chấp nhận
**And** missing/mismatched headers bị API từ chối `403` trong integration test.

**Given** CI chạy integration gates
**When** Better Auth bootstrap, auth migration, session resolution, OpenAPI diff và CSRF acceptance/rejection tests chạy
**Then** tất cả phải pass trước merge.

### Story 1.4: Đăng ký và xác minh email

**Requirements:** FR-1
Là một marketer,
Tôi muốn đăng ký bằng email/password và xác minh email,
Để tôi có thể kích hoạt tài khoản an toàn.

**Acceptance Criteria:**

**Given** marketer chưa đăng nhập
**When** họ mở Sign up
**Then** form hiển thị label rõ cho email và password
**And** hỗ trợ `autocomplete`, paste, password manager và nút hiện/ẩn password có accessible name/state
**And** input có chiều cao tối thiểu 44px và font size ít nhất 16px.

**Given** marketer nhập email hợp lệ và password đạt security policy
**When** họ submit form
**Then** Better Auth tạo account ở trạng thái chưa xác minh
**And** password được hash bằng cấu hình Better Auth đã pin
**And** email verification được gửi qua email adapter ngoài database transaction
**And** response không tiết lộ account đã tồn tại hay chưa.

**Given** verification email được gửi hoặc account đã tồn tại
**When** Sign up hoàn tất
**Then** giao diện hiển thị verification-pending state với thông báo kiểm tra inbox
**And** cung cấp “Resend email” theo cooldown
**And** cung cấp “Back to sign in”
**And** không tự động đăng nhập account chưa xác minh.

**Given** email provider tạm thời thất bại
**When** verification email không gửi được
**Then** account giữ trạng thái chưa xác minh
**And** marketer nhận recoverable generic message
**And** có thể resend sau cooldown
**And** log không chứa verification token, password hoặc email secret.

**Given** marketer dùng verification token hợp lệ
**When** verification endpoint xử lý token
**Then** email được đánh dấu verified
**And** giao diện hiển thị verified-success state với action Sign in
**And** token được phép mở lại trong thời hạn; replay hợp lệ trả thành công nhưng không tạo session, gửi email hoặc tạo side effect mới.

**Given** verification token hết hạn hoặc không hợp lệ
**When** marketer mở verification URL
**Then** giao diện giải thích token invalid/expired
**And** cung cấp resend action
**And** không tiết lộ thêm thông tin tài khoản.

**Given** marketer resend liên tục
**When** vượt verification cooldown hoặc rate limit
**Then** request bị từ chối bằng HTTP `429`
**And** response có `Retry-After`
**And** không gửi thêm email.

**Given** form có một hoặc nhiều lỗi
**When** marketer submit
**Then** submit vẫn kích hoạt validation
**And** error summary nhận focus và liên kết tới field lỗi
**And** field dùng `aria-invalid` và `aria-describedby`
**And** giá trị email được giữ lại, password không bị ghi log
**And** lỗi blocking được screen reader thông báo bằng `role="alert"`.

**Given** signup request đang xử lý hoặc gặp timeout
**When** marketer submit lại
**Then** duplicate submit bị chặn
**And** form hiển thị loading state
**And** network failure giữ dữ liệu an toàn và cung cấp retry
**And** không tạo nhiều tài khoản từ cùng request.

### Story 1.5: Đăng nhập và quản lý session

**Requirements:** FR-1, FR-3
Là một marketer đã xác minh email,
Tôi muốn đăng nhập, sử dụng authenticated workspace và đăng xuất,
Để tôi quản lý campaign links của mình an toàn.

**Acceptance Criteria:**

**Given** marketer có account email/password đã xác minh
**When** họ nhập credentials đúng
**Then** Better Auth tạo session
**And** session cookie dùng `HttpOnly`, `Secure` trong production và `SameSite=Lax`
**And** marketer được đưa vào Dashboard
**And** protected API resolve canonical string `ActorId`.

**Given** account chưa xác minh email
**When** marketer cố đăng nhập
**Then** hệ thống không tạo authenticated session
**And** hiển thị verification-pending guidance
**And** cung cấp resend action theo cooldown.

**Given** email không tồn tại hoặc password sai
**When** marketer submit Sign in
**Then** response dùng generic credential error
**And** không tiết lộ account có tồn tại
**And** form giữ email nhưng không giữ/log password.

**Given** marketer hoặc một IP vượt login rate limit
**When** họ tiếp tục gửi login requests
**Then** PostgreSQL-backed atomic rate limiter trả HTTP `429`
**And** response có `Retry-After`
**And** không tạo session
**And** throttle metric được ghi nhận.

**Given** authenticated marketer truy cập Dashboard, Links hoặc Account
**When** API xử lý request
**Then** session được resolve một lần tại HTTP boundary
**And** immutable Actor context được truyền vào use case
**And** request không có session hợp lệ trả HTTP `401`.

**Given** unsafe browser mutation từ ứng dụng
**When** request có `Origin` đúng public origin và `Sec-Fetch-Site: same-origin`
**Then** request được phép đi tiếp tới authorization/use case
**And** generated browser client gửi same-origin credentials.

**Given** unsafe mutation thiếu, có opaque hoặc mismatched `Origin`/`Sec-Fetch-Site`
**When** API nhận request
**Then** trả HTTP `403`
**And** không thực hiện mutation
**And** không dùng CSRF token fallback.

**Given** marketer chọn Logout
**When** logout hoàn tất
**Then** session bị invalidated
**And** protected routes không còn truy cập được
**And** giao diện trở về Sign in
**And** Sign in nêu rõ password reset chưa có trong MVP, không hiển thị action giả hoặc dead link.

**Given** logout request thất bại
**When** session vẫn còn hiệu lực
**Then** UI không giả vờ đã đăng xuất
**And** hiển thị recoverable error
**And** authenticated state hiện tại được giữ rõ ràng.

**Given** session hết hạn khi marketer đang ở protected route
**When** API trả unauthenticated
**Then** UI yêu cầu Sign in lại
**And** giữ intended route
**And** chỉ phục hồi unsaved form từ safe local state
**And** không lưu password hoặc auth secret.

**Given** authenticated marketer điều hướng bằng keyboard hoặc screen reader
**When** route thay đổi
**Then** page title và main heading phản ánh surface mới
**And** focus chuyển đến main content
**And** app shell có đúng một active navigation item
**And** sidebar/drawer hoạt động bằng keyboard, Escape và focus return.

### Story 1.6: Đăng nhập bằng Google

**Requirements:** FR-2
Là một marketer,
Tôi muốn đăng nhập bằng tài khoản Google,
Để tôi truy cập workspace mà không cần tạo password mới.

**Acceptance Criteria:**

**Given** marketer chưa đăng nhập
**When** họ chọn “Continue with Google”
**Then** hệ thống bắt đầu Google OAuth/OIDC flow
**And** dùng configured trusted origin và callback URL
**And** tạo, lưu và kiểm tra `state`
**And** tạo và kiểm tra `nonce` khi dùng OIDC.

**Given** Google xác thực thành công với email chưa thuộc account nào
**When** callback được xử lý
**Then** Better Auth tạo account Google mới
**And** email verified claim được kiểm tra theo provider contract
**And** session cookie an toàn được phát hành
**And** marketer được đưa vào Dashboard.

**Given** Google trả email đã thuộc một account Google được liên kết
**When** callback hợp lệ
**Then** marketer đăng nhập vào đúng account hiện có
**And** không tạo duplicate user hoặc ownership mới.

**Given** Google trả email khớp account email/password chưa liên kết
**When** callback được xử lý
**Then** hệ thống không tạo account mới
**And** không tự merge hoặc đăng nhập chỉ dựa trên email claim
**And** chuyển marketer về Sign in với account-collision guidance
**And** giữ intended route an toàn để dùng sau khi linking hoàn tất.

**Given** OAuth `state` hoặc OIDC `nonce` thiếu hoặc không khớp
**When** callback được xử lý
**Then** hệ thống từ chối login
**And** không tạo account/session
**And** trả generic security error
**And** ghi security event không chứa OAuth token hoặc authorization code.

**Given** marketer hủy Google consent
**When** provider trả cancellation
**Then** UI quay về Sign in
**And** hiển thị non-enumerating cancellation message
**And** cho phép thử lại hoặc dùng email/password.

**Given** Google tạm thời không khả dụng hoặc callback gặp network/server failure
**When** flow thất bại
**Then** không tạo partial account/session
**And** UI hiển thị recoverable error với retry
**And** intended route được giữ nếu an toàn.

**Given** callback URL hoặc origin không nằm trong cấu hình production
**When** OAuth flow được khởi tạo hoặc callback nhận request
**Then** request bị từ chối
**And** không fallback sang wildcard origin
**And** lỗi cấu hình xuất hiện trong readiness/integration test.

**Given** CI chạy auth integration tests
**When** Google provider được stub ở boundary
**Then** test bao phủ successful new account, existing linked account, email collision, cancellation, invalid `state`, invalid `nonce` và provider failure
**And** tất cả test phải pass trước merge.

### Story 1.7: Liên kết Google an toàn

**Requirements:** FR-2, FR-3
Là một marketer đã đăng nhập bằng email/password,
Tôi muốn liên kết tài khoản Google sau khi xác minh lại danh tính,
Để tôi có thể dùng Google cho các lần đăng nhập sau mà không tạo account trùng.

**Acceptance Criteria:**

**Given** marketer gặp account-collision khi đăng nhập Google
**When** họ quay về Sign in
**Then** UI giải thích Google chưa được liên kết
**And** hướng dẫn đăng nhập bằng email/password hiện có
**And** không tiết lộ thêm dữ liệu tài khoản
**And** không tạo duplicate account/session.

**Given** marketer đã đăng nhập bằng email/password
**When** họ mở Account
**Then** surface hiển thị trạng thái Google chưa liên kết
**And** cung cấp action “Link Google”
**And** action hoạt động bằng keyboard và có accessible name.

**Given** marketer chọn “Link Google”
**When** session không còn fresh theo security policy
**Then** hệ thống yêu cầu re-authentication bằng phương thức hiện có
**And** không bắt đầu linking trước khi re-auth thành công
**And** password không được lưu hoặc log.

**Given** re-authentication thành công
**When** Google OAuth/OIDC linking flow bắt đầu
**Then** hệ thống tạo và kiểm tra `state`/`nonce`
**And** hiển thị identity Google sắp liên kết trước confirmation
**And** chỉ liên kết khi verified email phù hợp với policy.

**Given** Google identity hợp lệ và marketer xác nhận
**When** linking transaction hoàn tất
**Then** Google identity được liên kết với cùng canonical user ID
**And** owner FK và existing Short Links không đổi
**And** không tạo user mới
**And** Account hiển thị trạng thái linked thành công.

**Given** Google identity đã liên kết với account khác
**When** marketer cố liên kết
**Then** hệ thống từ chối operation
**And** không thay đổi account nào
**And** hiển thị generic recoverable conflict message
**And** ghi security event không chứa OAuth token.

**Given** marketer hủy consent hoặc linking flow thất bại
**When** callback trả cancellation/error
**Then** account hiện tại vẫn đăng nhập
**And** Google vẫn ở trạng thái chưa liên kết
**And** Account hiển thị cancel/failure message và retry action.

**Given** unsafe linking mutation có `Origin` hoặc `Sec-Fetch-Site` không hợp lệ
**When** API nhận request
**Then** trả HTTP `403`
**And** không liên kết identity
**And** không dùng token fallback.

**Given** marketer đã liên kết Google
**When** họ đăng xuất rồi đăng nhập bằng Google
**Then** hệ thống mở đúng canonical account cũ
**And** marketer thấy cùng dữ liệu/ownership
**And** không tạo duplicate account.

**Given** CI chạy account-linking integration suite
**When** test thực thi fresh re-auth, success, already-linked conflict, other-account conflict, cancel, provider failure và CSRF rejection
**Then** tất cả scenario phải pass trước merge.

## Epic 2: Create and manage campaign links

Marketer có thể tạo Short Link dễ đọc, cấu hình UTM, xem danh sách, sửa destination và xóa link an toàn.

### Story 2.1: Tạo Short Link bằng generated Code

**Requirements:** FR-4
Là một marketer đã đăng nhập,
Tôi muốn tạo Short Link từ Destination URL,
Để tôi có thể chia sẻ một URL ngắn cho chiến dịch.

**Acceptance Criteria:**

**Given** marketer mở Create Link
**When** surface tải thành công
**Then** form hiển thị Destination URL bắt buộc và Alias tùy chọn
**And** Alias để trống mặc định
**And** có visible labels, helper text và final URL preview
**And** form hoạt động bằng keyboard và tại 320 CSS px.

**Given** marketer nhập Destination URL hợp lệ dùng `http` hoặc `https` và không nhập Alias
**When** họ chọn “Create short link”
**Then** application tạo generated Code qua `ShortPath` allocator
**And** Code dùng alphabet/length đã cấu hình
**And** Code được normalize và kiểm tra bằng cùng namespace rules với Alias
**And** Short Link thuộc canonical `ActorId` hiện tại.

**Given** generated Code chưa tồn tại
**When** transaction tạo link chạy
**Then** một `short_path_registry` row trạng thái `active` và một Short Link được tạo atomically
**And** registry trỏ chính xác tới Short Link
**And** Destination URL được lưu ở canonical validated form
**And** không tạo Tombstone.

**Given** generated Code va chạm active path, reserved path hoặc tombstoned path
**When** PostgreSQL trả named namespace unique violation
**Then** allocator thử Code mới trong bounded retry limit
**And** không để lại partial registry/link row
**And** unrelated unique violations không bị chuyển thành alias-collision error.

**Given** bounded collision retry hết giới hạn
**When** link vẫn chưa được tạo
**Then** transaction rollback
**And** API trả RFC 9457 problem response phù hợp
**And** UI giữ Destination URL và cung cấp retry
**And** không hiển thị internal database details.

**Given** Destination URL thiếu scheme, malformed hoặc không dùng `http`/`https`
**When** marketer submit
**Then** không tạo registry hoặc Short Link
**And** inline error ghi rõ “Use an `http` or `https` URL.”
**And** error summary nhận focus và liên kết tới field
**And** field có `aria-invalid` và `aria-describedby`.

**Given** marketer submit create request
**When** request đang xử lý
**Then** duplicate submit bị chặn
**And** button hiển thị loading state
**And** các giá trị form được giữ nguyên
**And** không có automatic route change.

**Given** Short Link được tạo thành công
**When** API trả resource
**Then** success state hiển thị full Short URL và Destination URL
**And** cung cấp “Copy link” và “View analytics”
**And** “View analytics” mở Link detail analytics section bằng explicit navigation
**And** khi analytics data chưa được triển khai hoặc link chưa có click, section hiển thị empty analytics state
**And** Epic 2 không phụ thuộc aggregate/query implementation của Epic 4
**And** link xuất hiện trong owned Links list
**And** thành công được thông báo bằng `aria-live="polite"`.

**Given** marketer không sở hữu authenticated session hợp lệ
**When** họ gọi create endpoint
**Then** API trả HTTP `401`
**And** không tạo namespace/link data.

**Given** unsafe create request có `Origin` hoặc `Sec-Fetch-Site` không hợp lệ
**When** API nhận request
**Then** trả HTTP `403`
**And** không tạo dữ liệu.

### Story 2.2: Tạo custom Alias trong global namespace

**Requirements:** FR-5
Là một marketer,
Tôi muốn đặt Alias dễ đọc cho Short Link,
Để link phù hợp với nội dung chiến dịch.

**Acceptance Criteria:**

**Given** marketer nhập Alias
**When** field mất focus hoặc form được submit
**Then** Alias được normalize lowercase
**And** helper text nêu rõ quy tắc `3–64` ký tự, chỉ `a-z`, `0-9`, `-`
**And** không âm thầm thay đổi ký tự ngoài lowercase normalization.

**Given** Alias hợp lệ
**When** transaction tạo link chạy
**Then** Alias và generated Code dùng chung `ShortPath` allocator
**And** PostgreSQL `short_path_registry` là nguồn quyết định uniqueness
**And** Alias được kiểm tra global, không chỉ trong tài khoản hiện tại.

**Given** Alias bắt đầu hoặc kết thúc bằng `-`, quá ngắn, quá dài, chứa Unicode, khoảng trắng, slash hoặc ký tự không hợp lệ
**When** marketer submit
**Then** API từ chối request
**And** không tạo registry hoặc Short Link
**And** trả RFC 9457 problem với `fieldErrors.alias`
**And** UI hiển thị lỗi sát field và giữ các giá trị còn lại.

**Given** Alias trùng active Code hoặc Alias
**When** PostgreSQL trả unique violation của named namespace constraint
**Then** API trả conflict error dành riêng cho Alias
**And** UI hiển thị “That alias is unavailable. Try another.”
**And** không tiết lộ owner hoặc metadata của link đang giữ path.

**Given** Alias trùng Tombstone
**When** marketer submit
**Then** hệ thống từ chối tạo link
**And** không tái sử dụng path
**And** UI dùng cùng unavailable message, không tiết lộ lịch sử đã xóa.

**Given** Alias trùng Reserved Path hoặc reserved prefix
**When** marketer submit
**Then** hệ thống từ chối trước hoặc trong namespace allocation
**And** không tạo dữ liệu
**And** route ứng dụng hiện tại không bị shadow.

**Given** hai marketer đồng thời yêu cầu cùng Alias
**When** cả hai transaction chạy
**Then** đúng một transaction tạo Short Link
**And** transaction còn lại nhận conflict
**And** không có duplicate registry row hoặc partial link.

**Given** request chứa percent-encoded hoặc noncanonical root segment
**When** Alias được xử lý
**Then** `ShortPath` value object percent-decode đúng một lần
**And** từ chối double-encoding, Unicode hoặc giá trị không khớp canonical grammar
**And** database CHECK vẫn là lớp bảo vệ cuối.

**Given** Alias hợp lệ và chưa được cấp
**When** creation thành công
**Then** preview và success state hiển thị đúng `/{Alias}` lowercase
**And** copy action sao chép full Short URL
**And** screen reader nhận thông báo thành công qua polite live region.

**Given** CI chạy namespace tests
**When** test thực thi active collision, Code/Alias collision, Tombstone, Reserved Path, concurrent allocation, canonicalization và DB CHECK
**Then** tất cả scenario phải pass.

### Story 2.3: Tạo campaign URL bằng UTM builder

**Requirements:** FR-12
Là một marketer,
Tôi muốn cấu hình UTM Parameters khi tạo Short Link,
Để tôi theo dõi campaign và channel nhất quán.

**Acceptance Criteria:**

**Given** marketer mở Create Link
**When** họ mở Campaign attribution
**Then** UTM builder hiển thị `utm_source`, `utm_medium`, `utm_campaign`
**And** section có thể expand/collapse bằng keyboard
**And** trạng thái expanded được công bố bằng `aria-expanded`.

**Given** marketer nhập Destination URL và UTM values
**When** input thay đổi
**Then** application URL composer trả final URL preview
**And** web dùng kết quả/contract từ application/API thay vì tự triển khai thuật toán URL khác
**And** preview cập nhật mà không mất focus.

**Given** UTM value có khoảng trắng đầu/cuối
**When** final URL được compose
**Then** khoảng trắng đầu/cuối bị trim
**And** casing bên trong được giữ nguyên
**And** giá trị được percent-encode đúng một lần.

**Given** UTM value chứa chữ hoa hoặc khoảng trắng bên trong
**When** marketer nhập xong field
**Then** UI hiển thị non-blocking warning
**And** marketer vẫn có thể tiếp tục tạo link
**And** warning giải thích nguy cơ chia nhỏ campaign reports
**And** warning không chỉ dựa vào màu.

**Given** Destination URL đã có `utm_source`, `utm_medium` hoặc `utm_campaign`
**When** UTM builder cung cấp cùng key
**Then** builder value thay thế giá trị cũ
**And** mỗi UTM key chỉ xuất hiện một lần trong final URL.

**Given** Destination URL chứa query parameters không phải UTM và fragment
**When** final URL được compose
**Then** các query parameters khác được giữ nguyên
**And** fragment được giữ nguyên
**And** UTM Parameters được đặt đúng trước fragment.

**Given** một hoặc nhiều UTM field để trống
**When** URL được compose
**Then** field trống không tạo query parameter rỗng
**And** các UTM field có giá trị vẫn được giữ.

**Given** UTM value vượt length limit, chứa control characters hoặc decode thành giá trị không hợp lệ
**When** marketer submit
**Then** API từ chối field tương ứng
**And** trả RFC 9457 `fieldErrors`
**And** không tạo Short Link
**And** form giữ các giá trị an toàn.

**Given** Short Link có UTM được tạo thành công
**When** resource được lưu
**Then** Destination URL lưu final composed URL
**And** preview/success state hiển thị final destination
**And** copy action chỉ sao chép Short URL, không nhầm Destination URL.

**Given** marketer tạo hai link cùng Destination URL nhưng khác `utm_medium`
**When** creation hoàn tất
**Then** mỗi Short Link giữ UTM configuration riêng
**And** link email và paid-social có final URLs khác nhau
**And** list/detail phân biệt được hai campaign links bằng Short Path và UTM configuration.

**Given** test suite chạy URL composition cases
**When** kiểm tra duplicate keys, existing query, fragment, casing, trim, internal spaces, percent encoding, empty values và control characters
**Then** browser preview và API result phải nhất quán
**And** tất cả table-driven tests phải pass.

### Story 2.4: Xem và tìm danh sách link

**Requirements:** FR-6 (partial — list metadata, ownership and search)
Là một marketer,
Tôi muốn xem và tìm các Short Link của mình,
Để tôi nhanh chóng chọn đúng campaign link cần quản lý.

**Acceptance Criteria:**

**Given** marketer đã đăng nhập và có Short Links
**When** họ mở Links
**Then** danh sách chỉ hiển thị link thuộc canonical `ActorId` hiện tại
**And** mỗi row hiển thị Short Path, Destination URL và ngày tạo
**And** Short Path xuất hiện trước Destination URL
**And** total click được bổ sung bởi Story 4.1 mà không đổi list ownership contract.

**Given** Marketer A và Marketer B có dữ liệu riêng
**When** Marketer A gọi list/search API
**Then** repository query luôn scope theo owner ID
**And** không trả metadata, count hoặc existence signal của link thuộc Marketer B.

**Given** danh sách có nhiều link
**When** marketer nhập Alias hoặc Destination URL vào search
**Then** kết quả được lọc theo dữ liệu thuộc tài khoản hiện tại
**And** search state được phản ánh trong URL/router state
**And** back navigation khôi phục search và scroll position.

**Given** search không có kết quả
**When** response hoàn tất
**Then** UI hiển thị no-results state rõ ràng
**And** cung cấp action xóa search hoặc tạo Short Link
**And** không hiển thị blank table.

**Given** marketer chưa có Short Link
**When** họ mở Links
**Then** UI hiển thị “No short links yet.”
**And** có một primary action “Create short link”
**And** không render empty chart hoặc fake metrics.

**Given** marketer dùng keyboard hoặc screen reader
**When** điều hướng danh sách
**Then** `<tr>` không được dùng làm interactive control
**And** Short Path là native link trong cell đầu
**And** edit/delete/more actions là native buttons hoặc links
**And** focus order theo visual reading order.

**Given** marketer chọn rows
**When** native checkboxes thay đổi
**Then** UI hiển thị selected count và giới hạn selection theo configured Compare contract
**And** checkbox có accessible label chứa Short Path
**And** list/search vẫn hoạt động độc lập với analytics implementation

**Given** Destination URL dài hơn cell
**When** table render
**Then** URL có thể truncate trực quan
**And** full value vẫn truy cập được bằng accessible text/title/expand behavior
**And** Short Path không bị truncate mất khả năng nhận diện.

**Given** API đang tải dữ liệu
**When** Links surface render
**Then** skeleton khớp geometry của table
**And** không gây layout shift đáng kể
**And** container có trạng thái `aria-busy`.

**Given** list/search request thất bại
**When** API trả network/server error
**Then** UI hiển thị recoverable error với Retry
**And** giữ search/filter state hiện tại
**And** không thay lỗi bằng empty-state message.

**Given** viewport dưới 768px hoặc 320 CSS px
**When** Links surface render
**Then** navigation dùng drawer
**And** table nằm trong labeled horizontal-scroll region
**And** Create action còn truy cập được trong top bar
**And** không có hover-only action.

### Story 2.5: Xem Link detail và copy Short Link

**Requirements:** FR-6
Là một marketer,
Tôi muốn xem chi tiết và copy Short Link,
Để tôi có thể kiểm tra rồi chia sẻ đúng campaign URL.

**Acceptance Criteria:**

**Given** marketer chọn Short Path từ Links
**When** Link detail tải
**Then** surface hiển thị Short URL, Destination URL, ngày tạo và trạng thái hiện có
**And** dữ liệu chỉ được trả khi link thuộc canonical `ActorId` hiện tại
**And** page title/main heading chứa Short Path.

**Given** marketer yêu cầu detail của link thuộc account khác
**When** API xử lý request
**Then** không trả metadata hoặc existence signal
**And** response dùng authorization/not-found policy nhất quán
**And** security event không log Destination query hoặc sensitive data.

**Given** marketer chọn Copy link
**When** Clipboard API thành công
**Then** full Short URL được copy
**And** button hoặc toast hiển thị “Copied”
**And** screen reader nhận polite live announcement
**And** Destination URL không bị copy nhầm.

**Given** Clipboard API bị từ chối hoặc không khả dụng
**When** marketer chọn Copy link
**Then** UI hiển thị visible fallback để chọn/copy Short URL thủ công
**And** không báo thành công giả
**And** focus vẫn ở vùng thao tác copy.

**Given** Short URL hoặc Destination URL dài
**When** detail render
**Then** text được wrap hoặc expose đầy đủ
**And** không gây overflow ngoài viewport
**And** Short URL vẫn dễ nhận diện.

**Given** link vừa được tạo
**When** marketer chọn “View analytics” từ success state
**Then** Link detail mở tại analytics section bằng explicit navigation
**And** empty analytics state không yêu cầu Epic 4 data implementation
**And** không có automatic redirect khỏi create success
**And** back navigation quay về trạng thái tạo/list hợp lý.

**Given** Link detail đang tải
**When** surface render
**Then** skeleton giữ geometry của metadata và actions
**And** không gây layout jump
**And** main region có `aria-busy`.

**Given** detail request thất bại
**When** API trả network/server error
**Then** UI hiển thị recoverable error và Retry
**And** không hiển thị dữ liệu stale như dữ liệu mới
**And** không thay lỗi bằng “Link not found” nếu chưa xác định 404.

**Given** link đã bị xóa trước khi detail request hoàn tất
**When** API trả not-found/deleted result
**Then** UI không hiển thị destination cũ
**And** chuyển sang unavailable state với back-to-Links action
**And** không cung cấp copy action.

**Given** marketer dùng keyboard hoặc screen reader
**When** điều hướng Link detail
**Then** Copy, Edit, Delete và back actions là native controls
**And** focus order đúng reading order
**And** không có chức năng chỉ xuất hiện khi hover.

**Given** viewport dưới 768px
**When** Link detail render
**Then** metadata và actions stack thành một cột
**And** Copy action nằm trong Link detail header
**And** controls đạt tối thiểu 44×44px
**And** không có generic sticky action che nội dung.

### Story 2.6: Sửa Destination URL an toàn

**Requirements:** FR-7
Là một marketer,
Tôi muốn sửa Destination URL mà giữ nguyên Short Path,
Để tôi sửa campaign link mà không cần phát hành lại URL.

**Acceptance Criteria:**

**Given** marketer sở hữu Short Link active
**When** họ chọn Edit
**Then** form hiển thị Destination URL hiện tại
**And** Short Path hiển thị read-only
**And** form dùng visible labels, helper text và generated API contract.

**Given** marketer nhập Destination URL `http` hoặc `https` hợp lệ
**When** họ lưu thay đổi
**Then** transaction cập nhật Destination URL
**And** Short Path, registry row và owner không đổi
**And** Short Link ID và version lineage không đổi để downstream history giữ cùng identity.

**Given** marketer nhập URL malformed hoặc scheme không được hỗ trợ
**When** họ submit
**Then** API từ chối mutation
**And** Destination URL cũ vẫn còn hiệu lực
**And** UI giữ input và hiển thị linked field error
**And** không thay đổi registry hoặc Short Link đã lưu.

**Given** Short Link đã thay đổi sau khi Edit surface tải
**When** marketer submit với expected version cũ
**Then** API từ chối bằng conflict response
**And** không ghi đè thay đổi mới hơn
**And** UI cung cấp reload/review action.

**Given** update request timeout sau khi server có thể đã commit
**When** UI nhận kết quả không xác định
**Then** client truy vấn lại resource bằng link ID
**And** so sánh expected destination/version trước khi retry
**And** không gửi mutation mù có thể ghi đè dữ liệu.

**Given** marketer không sở hữu link
**When** họ gọi edit endpoint
**Then** API không thay đổi dữ liệu
**And** không trả metadata hoặc existence signal của link.

**Given** unsafe mutation có `Origin` hoặc `Sec-Fetch-Site` không hợp lệ
**When** API nhận request
**Then** trả HTTP `403`
**And** không cập nhật Destination URL.

**Given** edit thành công
**When** API trả updated resource
**Then** UI hiển thị confirmation
**And** Link detail hiển thị Destination URL mới
**And** Short URL cũ vẫn được copy
**And** browser navigation không tự động rời surface nếu chưa có explicit action.

**Given** form save thất bại
**When** network/server error xảy ra
**Then** UI giữ input
**And** hiển thị recoverable error và Retry
**And** không báo success giả
**And** focus được đưa tới error summary phù hợp.

### Story 2.7: Xóa link và tombstone path

**Requirements:** FR-8
Là một marketer,
Tôi muốn xóa Short Link không còn sử dụng,
Để path ngừng redirect và không bị cấp lại cho campaign khác.

**Acceptance Criteria:**

**Given** marketer sở hữu Short Link active
**When** họ chọn Delete
**Then** confirmation dialog mở
**And** nêu rõ path sẽ trả `404` và không bao giờ được tái sử dụng
**And** destructive action tách biệt khỏi Cancel.

**Given** delete dialog mở
**When** keyboard hoặc screen reader được dùng
**Then** focus ban đầu đặt vào heading hoặc Cancel theo dialog policy
**And** background trở thành inert
**And** focus được giữ trong modal
**And** Escape/Close đóng dialog
**And** focus trở lại trigger.

**Given** marketer xác nhận xóa với expected version hiện tại
**When** transaction chạy
**Then** Short Link chuyển inactive/deleted
**And** `short_path_registry` chuyển atomically từ `active` sang `tombstoned`
**And** registry không còn active link reference
**And** transaction không cho state vừa active vừa tombstoned.

**Given** delete transaction thành công
**When** UI nhận response
**Then** row bị xóa khỏi Links
**And** marketer được đưa về Links
**And** confirmation nói path đã ngừng hoạt động
**And** Links không còn hiển thị row active; retained aggregate visibility do Epic 4 áp dụng theo ownership policy.

**Given** marketer hoặc hệ thống cố tạo Code/Alias bằng path đã tombstoned
**When** namespace allocation chạy
**Then** PostgreSQL từ chối allocation
**And** path không được tái sử dụng
**And** requester không thấy metadata của deleted link.

**Given** link đã bị sửa hoặc xóa sau khi dialog mở
**When** marketer xác nhận bằng expected version cũ
**Then** API trả conflict/not-found nhất quán
**And** không thực hiện mutation lần hai
**And** UI cung cấp quay lại Links hoặc reload.

**Given** delete request timeout sau khi có thể đã commit
**When** client nhận trạng thái không xác định
**Then** client reconcile bằng link ID trước retry
**And** nếu link đã deleted, UI xử lý như success
**And** không tạo duplicate tombstone hoặc lỗi giả.

**Given** marketer không sở hữu link
**When** họ gọi delete endpoint
**Then** API không thay đổi link/registry
**And** không tiết lộ existence hoặc owner.

**Given** delete transaction hoặc network thất bại
**When** operation chưa commit
**Then** link và registry vẫn ở trạng thái `active` như trước
**And** dialog giữ context
**And** UI hiển thị recoverable error/Retry
**And** không remove row hoặc báo success giả.

### Story 2.8: Rate-limit và chống duplicate create requests

**Requirements:** FR-4, FR-9
Là một marketer,
Tôi muốn thao tác tạo link được giới hạn và retry an toàn,
Để hệ thống chống spam mà không tạo duplicate Short Link.

**Acceptance Criteria:**

**Given** marketer authenticated gửi create request hợp lệ
**When** request nằm trong PostgreSQL-backed fixed window
**Then** request được xử lý bình thường
**And** counter update atomically giữa nhiều API instances
**And** rate-limit key scope theo account policy.

**Given** marketer vượt creation rate limit
**When** request mới được nhận
**Then** API trả HTTP `429`
**And** response có `Retry-After` và RFC 9457 problem body
**And** không tạo `short_path_registry`, Short Link hoặc UTM data
**And** throttle metric được ghi nhận.

**Given** marketer retry cùng create operation sau timeout
**When** request dùng cùng owner-scoped idempotency key
**Then** API trả cùng resource/result đã commit
**And** không tạo Code/Alias thứ hai
**And** retry không tăng sai rate-limit usage.

**Given** hai request dùng cùng idempotency key nhưng khác payload
**When** API xử lý request thứ hai
**Then** API trả conflict
**And** không thay đổi resource của request đầu
**And** không trả internal payload hoặc database details.

**Given** hai request cùng idempotency key chạy đồng thời
**When** transaction tạo link chạy
**Then** unique `(owner_id, idempotency_key)` đảm bảo chỉ một creation hoàn tất
**And** request còn lại nhận cùng deterministic result
**And** không tồn tại partial idempotency record trỏ tới resource không tồn tại.

**Given** create request có invalid URL, invalid Alias hoặc CSRF headers không hợp lệ
**When** API xử lý request
**Then** validation/HTTP `403` xảy ra trước resource mutation
**And** không tạo link
**And** response không tiết lộ sensitive details.

**Given** rate-limit store hoặc PostgreSQL không khả dụng
**When** API không thể đánh giá policy an toàn
**Then** create request fail closed với HTTP `503`
**And** không tạo Short Link vượt protection
**And** readiness/metrics ghi nhận dependency failure.

**Given** UI nhận HTTP `429`
**When** response có `Retry-After`
**Then** form giữ toàn bộ input
**And** hiển thị thời điểm có thể thử lại
**And** không auto-submit sau khi hết thời gian
**And** message được screen reader công bố.

**Given** create request đang xử lý
**When** marketer kích hoạt submit lần nữa
**Then** client ngăn duplicate submit
**And** button hiển thị trạng thái processing
**And** vẫn dùng cùng idempotency key nếu retry cần thiết.

**Given** rate-limit cleanup chạy
**When** fixed-window records hết hạn
**Then** cleanup theo batch không ảnh hưởng active windows
**And** logs không chứa secrets hoặc raw IP.

**Given** CI chạy creation-hardening suite
**When** test concurrent requests, multi-instance counter, `429`/`Retry-After`, same-key replay, payload conflict, partial failure và CSRF rejection
**Then** tất cả scenario phải pass.

### Story 2.9: Vô hiệu hóa malicious link qua operational control

**Requirements:** FR-8
Là một vận hành viên được ủy quyền,
Tôi muốn vô hiệu hóa Short Link malicious qua control vận hành được bảo vệ,
Để bảo vệ visitor mà không mở rộng MVP bằng admin UI hoặc RBAC subsystem.

**Scope:** Config/CLI/runbook-only operational control. MVP không có admin UI, product operator role, RBAC subsystem hoặc public operator route. Nếu cần các capability đó, phải có PRD/UX/Architecture change proposal mới.

**Acceptance Criteria:**

**Given** deployment identity hoặc operations credential không hợp lệ
**When** caller chạy protected operational command
**Then** command bị từ chối trước mutation
**And** không thay đổi Short Link/registry
**And** không tiết lộ Destination URL hoặc owner metadata
**And** credential source không được lưu trong repository.

**Given** authorized operational principal và denylist policy khớp Destination URL hoặc link ID được xác nhận malicious
**When** command chạy với reason code, expected version và idempotency key
**Then** link chuyển inactive và registry chuyển permanent `tombstoned` atomically
**And** owner không thể tự kích hoạt lại hoặc tái sử dụng path
**And** mutation dùng cùng UnitOfWork/state constraints với owner delete.

**Given** command thiếu reason, dùng stale expected version hoặc target không tồn tại
**When** use case xử lý
**Then** mutation bị từ chối bằng structured validation/conflict/not-found result
**And** không có partial state
**And** retry với cùng idempotency key trả deterministic result.

**Given** operational disable thành công
**When** audit event được ghi
**Then** event chứa operational principal ID, link ID, reason code, policy version, timestamp và correlation ID
**And** không chứa raw IP, credential, token, full Destination query hoặc secrets
**And** audit record không thể bị owner sửa/xóa.

**Given** owner mở Links hoặc Link detail sau khi operational disable
**When** owned resource được tải
**Then** UI hiển thị trạng thái disabled và generic safety guidance
**And** không cung cấp reactivate action
**And** owner-facing status không lộ denylist policy hoặc operational identity.

**Given** operational integration tests chạy
**When** test invalid credential, success, stale version, duplicate command, audit sanitization và permanent namespace reuse
**Then** mọi scenario phải pass
**And** không có admin HTTP route hoặc product RBAC model được tạo.

## Epic 3: Reliable public sharing and click capture

Visitor nhận redirect chính xác; hệ thống ghi nhận click bền vững, riêng tư và có khả năng retry.

### Story 3.1: Public redirect và route precedence

**Requirements:** FR-10
Là một visitor,
Tôi muốn mở Short Link và được chuyển tới Destination URL hiện tại,
Để tôi truy cập đúng nội dung campaign.

**Acceptance Criteria:**

**Given** request đi tới fixed reserved prefix như `/api/*`, `/api/auth/*`, health endpoint hoặc static asset
**When** NestJS xử lý route
**Then** request được chuyển tới reserved handler tương ứng
**And** không được xử lý như Short Path.

**Given** request là `GET` tới một exact one-segment root path
**When** path không thuộc fixed reserved registry
**Then** hệ thống canonicalize path bằng `ShortPath` value object
**And** lookup `short_path_registry` trước mọi SPA fallback.

**Given** registry chứa path ở trạng thái `active` và Short Link hợp lệ
**When** redirect lookup hoàn tất
**Then** hệ thống lấy Destination URL hiện tại từ PostgreSQL
**And** không dùng Redis hoặc cache khác làm nguồn sự thật.

**Given** active Short Link được mở bằng request được phép redirect
**When** redirect response được trả
**Then** response dùng HTTP `302`
**And** `Location` là Destination URL hiện tại
**And** có `Cache-Control: no-store`
**And** visitor không cần đăng nhập.

**Given** path không tồn tại hoặc ở trạng thái `tombstoned`
**When** visitor mở path
**Then** response trả HTTP `404`
**And** không chứa Destination URL cũ
**And** không redirect ra ngoài
**And** hiển thị minimal chrome-free “Link not found” surface.

**Given** request là multi-segment browser route không thuộc reserved prefixes
**When** route phù hợp SPA policy
**Then** NestJS trả React SPA index
**And** exact one-segment path vẫn luôn được kiểm tra namespace trước SPA fallback.

**Given** một root application route mới trùng active hoặc tombstoned Short Path
**When** CI/deploy route-collision validation chạy
**Then** deployment thất bại
**And** route mới không được phát hành
**And** Short Path hiện có giữ precedence.

**Given** request chứa percent encoding, Unicode, slash hoặc noncanonical segment
**When** path được canonicalize
**Then** hệ thống percent-decode đúng một lần
**And** không map nhiều chuỗi khác nhau tới cùng path ngoài canonical policy
**And** malformed/double-encoded path trả HTTP `404` hoặc safe client error
**And** không lookup bằng raw untrusted value.

**Given** Destination URL vừa được sửa thành công
**When** request redirect tiếp theo lookup PostgreSQL
**Then** response trỏ tới Destination URL mới
**And** không dùng destination cũ do browser/CDN cache.

**Given** PostgreSQL lookup timeout, pool exhaustion hoặc database unavailable
**When** hệ thống không thể xác định Destination URL hiện tại
**Then** trả HTTP `503`
**And** không redirect bằng stale hoặc guessed destination
**And** readiness báo unavailable
**And** latency/dependency failure metric được ghi nhận.

**Given** public redirect request được log
**When** structured access/application logs được phát
**Then** log có request correlation ID và outcome status
**And** không lưu raw IP, cookie, token hoặc full Destination query
**And** không để proxy logs phá vỡ privacy policy.

**Given** CI chạy route integration suite
**When** test reserved route, active path, tombstone, missing path, SPA fallback, route collision, canonicalization, edited destination và DB failure
**Then** tất cả scenario phải pass.

### Story 3.2: Nhận diện bot và derive click dimensions

**Requirements:** FR-10, FR-11
Là một marketer,
Tôi muốn analytics loại bot/link preview và phân loại click theo nguồn, vị trí, thiết bị, trình duyệt,
Để số liệu campaign hữu ích mà không lưu raw IP.

**Acceptance Criteria:**

**Given** request tới active Short Link
**When** redirect pipeline nhận request
**Then** bot/preview detection và local enrichment chạy trong bounded request-path budget
**And** aggregation không chạy trên request path.

**Given** request được nhận diện là bot hoặc link preview
**When** redirect hoàn tất
**Then** visitor/client vẫn nhận HTTP `302` tới Destination URL
**And** hệ thống không tạo Click Event
**And** request không xuất hiện trong marketer analytics.

**Given** request được nhận diện là human
**When** enrichment chạy
**Then** hệ thống derive `referrer_host`, `country`, `city`, `device`, `browser`
**And** chỉ dùng pinned/versioned local bot/GeoIP/UA data
**And** không gọi remote enrichment service trên redirect path.

**Given** request đi qua Render proxy
**When** client address được xác định
**Then** hệ thống chỉ tin trusted proxy chain đã cấu hình
**And** không tin `X-Forwarded-For` do client tùy ý gửi
**And** raw IP chỉ tồn tại in-memory trong thời gian derive location/rate-policy cần thiết.

**Given** GeoIP, UA hoặc referrer parsing thất bại
**When** request vẫn là human
**Then** dimension lỗi được normalize thành `unknown`
**And** redirect/click capture vẫn tiếp tục
**And** không trả lỗi cho visitor chỉ vì enrichment.

**Given** request có referrer URL
**When** referrer được normalize
**Then** chỉ lưu origin/host
**And** loại bỏ path, query, fragment và userinfo
**And** không lưu token hoặc PII có thể nằm trong full referrer.

**Given** device/browser parser trả nhiều giá trị tùy ý
**When** dimensions được canonicalize
**Then** chúng được map vào bounded enums/configured values
**And** giá trị ngoài vocabulary trở thành `unknown` hoặc `other`
**And** không tạo unbounded analytics cardinality.

**Given** GeoIP trả country/city
**When** dữ liệu được lưu
**Then** country/city dùng canonical representation
**And** city được đánh dấu là estimated trong downstream contract
**And** raw IP không được ghi vào Click Event, logs hoặc aggregate facts.

**Given** enrichment data artifact thiếu, corrupt hoặc không load được
**When** API khởi động
**Then** startup/readiness behavior tuân theo configured safe mode
**And** service không âm thầm dùng stale/unversioned artifact
**And** nếu chạy degraded, affected dimensions luôn là `unknown` và metric cảnh báo được phát.

**Given** enrichment vượt time/CPU budget
**When** timeout xảy ra
**Then** pipeline dừng enrichment phần còn lại
**And** dùng `unknown` cho dimensions chưa derive
**And** tiếp tục durable click capture trong latency budget.

**Given** logs/metrics được phát
**When** enrichment hoàn tất hoặc fail
**Then** metrics chỉ ghi outcome/category/version/latency
**And** không chứa raw IP, full referrer, cookie, user-agent nguyên bản hoặc Destination query.

**Given** CI chạy enrichment test suite
**When** kiểm tra bot, link preview, human, spoofed proxy header, missing referrer, malformed UA, GeoIP failure, timeout và privacy sanitization
**Then** tất cả scenario phải pass.

### Story 3.3: Ghi durable Click Event trước redirect

**Requirements:** FR-10, FR-11
Là một marketer,
Tôi muốn mỗi human redirect hợp lệ được ghi nhận bền vững trước khi chuyển hướng,
Để analytics không mất click hoặc báo số liệu không thể reconcile.

**Acceptance Criteria:**

**Given** request là human và Short Link active đã được lookup
**When** enrichment hoàn tất hoặc fallback sang `unknown`
**Then** API tạo immutable event UUID
**And** chuẩn bị Click Event với Short Link ID, UTC timestamp, effective UTM snapshot và normalized dimensions.

**Given** Destination URL chứa UTM Parameters
**When** Click Event được tạo
**Then** `utm_source`, `utm_medium`, `utm_campaign` được snapshot tại event time
**And** snapshot không phụ thuộc Destination URL bị sửa trong tương lai.

**Given** Click Event hợp lệ
**When** PostgreSQL transaction commit
**Then** event được lưu ở trạng thái `pending`
**And** `available_at` dùng database clock
**And** `attempts` bắt đầu theo queue-state contract
**And** event không chứa raw IP, full referrer hoặc full Destination query.

**Given** Click Event commit thành công
**When** API trả response
**Then** visitor nhận HTTP `302`
**And** `Location` là Destination URL đã lookup
**And** response có `Cache-Control: no-store`.

**Given** event insert gặp transient database failure
**When** bounded retry vẫn nằm trong redirect latency budget
**Then** API thử lại theo configured bounded policy
**And** giữ cùng event UUID
**And** không tạo hai event cho cùng request.

**Given** event không thể commit sau bounded retry
**When** latency budget hoặc retry limit kết thúc
**Then** API trả HTTP `503`
**And** không redirect ra ngoài
**And** không tạo partial Click Event
**And** durability-failure metric/log được phát.

**Given** cùng request/event UUID được gửi lại do transport retry
**When** insert chạy lần nữa
**Then** database uniqueness ngăn duplicate event
**And** API trả deterministic result theo request policy
**And** downstream chỉ có một countable event.

**Given** Short Link bị delete hoặc edit giữa lookup và event insert
**When** transaction/use case kiểm tra version/state
**Then** không ghi event cho stale/deleted destination
**And** deleted state trả 404 hoặc conflict policy phù hợp
**And** edit dùng destination/version nhất quán trong một redirect operation.

**Given** request là bot/link preview
**When** redirect pipeline xử lý
**Then** không tạo Click Event
**And** vẫn trả HTTP `302` nếu Short Link active
**And** không ảnh hưởng human reconciliation.

**Given** structured logs được ghi
**When** event insert thành công hoặc thất bại
**Then** log có request/event correlation ID và outcome
**And** không chứa raw IP, cookie, token, full referrer hoặc Destination query.

**Given** CI chạy durability suite
**When** test success, transient retry, permanent failure, duplicate UUID, concurrent delete/edit, bot exclusion và privacy fields
**Then** mỗi successful human redirect tương ứng đúng một durable Click Event
**And** tất cả scenario phải pass.

### Story 3.4: Xử lý Click Event bằng fenced PostgreSQL worker

**Requirements:** FR-11
Là một vận hành viên hệ thống,
Tôi muốn worker xử lý Click Events theo queue-state contract,
Để sự cố hoặc nhiều worker không làm mất hoặc xử lý sai event.

**Acceptance Criteria:**

**Given** Click Event ở trạng thái `pending` với `available_at <= db_now()`
**When** worker claim batch
**Then** transaction dùng `FOR UPDATE SKIP LOCKED`
**And** atomically chuyển event sang `leased`
**And** gán fresh unique `lease_token`
**And** tính `lease_until` từ database clock
**And** tăng `attempts` đúng một lần tại claim.

**Given** nhiều worker claim đồng thời
**When** chúng query cùng tập pending events
**Then** mỗi event chỉ được một worker giữ active lease
**And** workers không block nhau trên rows đã lock
**And** không event nào được xử lý đồng thời bởi hai lease hợp lệ.

**Given** worker hoàn tất xử lý trong lease
**When** cập nhật event state
**Then** predicate bắt buộc `state='leased' AND lease_token=:token`
**And** stale worker không thể commit bằng token cũ.

**Given** worker chết hoặc mất kết nối sau khi claim
**When** `lease_until < db_now()`
**Then** event đủ điều kiện được reclaim
**And** claim mới cấp token mới
**And** worker cũ không thể ghi kết quả nếu quay lại.

**Given** processing thất bại trước attempt thứ 5
**When** current lease token vẫn hợp lệ
**Then** event chuyển về `pending`
**And** `available_at` được đặt bằng database-clock exponential backoff
**And** failure metadata không chứa secrets/PII
**And** retry metric tăng.

**Given** processing thất bại ở attempt thứ 5
**When** worker cập nhật state
**Then** event chuyển `dead_letter`
**And** dead-letter alert được phát
**And** event vẫn replayable trước mốc retention 30 ngày
**And** không bị retry tự động vô hạn.

**Given** worker khởi động hoặc reconnect
**When** polling loop bắt đầu
**Then** worker scan pending/expired-leased rows ngay
**And** không phụ thuộc notification history
**And** mandatory timeout polling vẫn hoạt động khi LISTEN/NOTIFY tắt.

**Given** LISTEN/NOTIFY được bật như optimization
**When** listener đăng ký hoặc reconnect
**Then** dùng dedicated connection
**And** commit LISTEN trước scan
**And** re-LISTEN rồi rescan sau reconnect
**And** notification chỉ là wake hint, không phải job/acknowledgement.

**Given** backlog lớn hơn worker capacity
**When** polling/claim tiếp tục
**Then** worker dùng bounded batch và concurrency
**And** không tải toàn bộ queue vào memory
**And** event-age/queue-lag metric tăng
**And** backpressure không làm API mất durable events.

**Given** worker nhận SIGTERM
**When** shutdown bắt đầu
**Then** worker ngừng claim batch mới
**And** hoàn tất bounded in-flight transaction hoặc để lease hết hạn
**And** đóng listener/pool sạch trước process deadline.

**Given** CI chạy worker concurrency suite
**When** test multi-worker claim, crash/reclaim, stale token, retries, fifth-attempt dead-letter, reconnect và graceful shutdown
**Then** tất cả legal state transitions được kiểm chứng
**And** illegal transition bị database/application guard từ chối.

### Story 3.5: Idempotent aggregation và dead-letter recovery

**Requirements:** FR-11
Là một marketer,
Tôi muốn mỗi Click Event chỉ được tính một lần dù worker retry,
Để analytics luôn khớp với các human redirects hợp lệ.

**Acceptance Criteria:**

**Given** worker giữ lease hợp lệ cho Click Event chưa xử lý
**When** aggregation transaction bắt đầu
**Then** transaction trước tiên chạy `INSERT INTO processed_event(event_id, short_link_id, processed_at) ... ON CONFLICT DO NOTHING RETURNING event_id`
**And** chỉ transaction nhận được `event_id` mới được cập nhật aggregate fact.

**Given** processed-event marker được acquire
**When** daily fact được cập nhật
**Then** worker UPSERT vào fact key gồm `utc_day`, `short_link_id`, `referrer_host`, `country`, `city`, `device`, `browser`, `utm_source`, `utm_medium`, `utm_campaign`
**And** mọi dimension đều non-null
**And** giá trị thiếu dùng canonical `unknown`.

**Given** aggregate UPSERT thành công
**When** transaction hoàn tất
**Then** Click Event chuyển `processed` với đúng current lease token
**And** processed marker, fact increment và event state commit atomically
**And** không có partial aggregate.

**Given** cùng event UUID được worker khác hoặc retry xử lý lại
**When** `processed_event` insert gặp conflict
**Then** transaction không increment fact
**And** raw event được reconcile sang processed nếu cần
**And** duplicate là no-op.

**Given** hai worker xử lý cùng event do lease race
**When** cả hai cố commit
**Then** processed-event unique constraint chỉ cho một worker acquire marker
**And** lease-token predicate chặn stale worker cập nhật state
**And** click count chỉ tăng một lần.

**Given** Click Event xảy ra sau khi Destination URL được sửa
**When** worker aggregate event
**Then** dùng event-time UTM snapshot
**And** không đọc current Destination URL để tái tạo UTM
**And** historical attribution giữ nguyên.

**Given** dimensions chứa referrer hoặc UTM data
**When** fact được ghi
**Then** referrer chỉ là normalized host/origin
**And** UTM values đã bounded, reject control characters và decode một lần
**And** device/browser là bounded enum
**And** không có raw IP, full URL, query, fragment hoặc userinfo.

**Given** processing thất bại và event vào `dead_letter`
**When** operator replay trước ngày thứ 30
**Then** event quay lại queue theo controlled transition
**And** processed marker ngăn double-count nếu event đã commit trước failure ambiguity
**And** replay được audit bằng event ID.

**Given** dead-letter chưa xử lý tới ngày retention
**When** raw event đạt 30 ngày
**Then** raw/dead-letter row bị xóa
**And** processed-event ledger không cascade theo raw row
**And** reconciliation-loss metric/alert được phát nếu event chưa aggregate.

**Given** processed-event ledger được retention
**When** raw Click Event bị xóa
**Then** ledger được giữ ít nhất lâu bằng aggregate facts
**And** replay/import của event UUID cũ không làm tăng count lần nữa.

**Given** CI chạy idempotency suite
**When** test normal processing, duplicate delivery, lease race, failure before/after marker, aggregate rollback, dead-letter replay và raw deletion
**Then** aggregate count luôn bằng số unique processed human Click Events
**And** tất cả scenario phải pass.

### Story 3.6: Raw-event retention

**Requirements:** FR-11
Là một vận hành viên hệ thống,
Tôi muốn raw events được xóa đúng hạn,
Để hệ thống đáp ứng privacy policy mà vẫn giữ aggregates và idempotency ledger cần thiết.

**Acceptance Criteria:**

**Given** raw Click Events chưa đủ 30 ngày
**When** retention job chạy
**Then** events không bị xóa sớm
**And** pending/leased/dead-letter events vẫn tuân thủ queue policy
**And** retained aggregate facts không bị thay đổi.

**Given** raw hoặc dead-letter event đạt 30 ngày theo database UTC clock
**When** singleton retention job claim lease
**Then** event được xóa theo bounded batches
**And** processed-event ledger không cascade
**And** daily dimensional facts được giữ
**And** deleted-link facts vẫn ẩn khỏi dashboard.

**Given** event chưa được aggregate khi đạt 30 ngày
**When** retention xóa event
**Then** reconciliation-loss counter tăng
**And** alert được phát
**And** log chỉ chứa event ID/outcome, không chứa raw dimensions nhạy cảm.

**Given** nhiều worker có thể chạy retention
**When** schedule tới hạn
**Then** singleton lease đảm bảo chỉ một retention job active
**And** stale lease holder không thể commit batch sau khi lease mất
**And** failure cho phép job khác tiếp tục.

**Given** retention batch gặp database error
**When** transaction rollback
**Then** không xóa partial batch
**And** job retry theo bounded backoff
**And** oldest raw event age tiếp tục được theo dõi.

**Given** raw event age gần hoặc vượt 30 ngày
**When** metrics được thu thập
**Then** `oldest_raw_event_age` phản ánh row cũ nhất
**And** alert kích hoạt trước/ở policy breach
**And** dashboard vận hành phân biệt warning và breach.

**Given** deployment chạy migration và retention đồng thời
**When** schema transition xảy ra
**Then** migration dùng advisory lock và N/N-1 compatibility
**And** retention kiểm tra schema compatibility trước claim
**And** migration failure chặn readiness/cutover.

**Given** CI chạy retention tests
**When** test 30-day boundary, batch rollback, concurrent lease và reconciliation-loss behavior
**Then** tất cả retention policy checks phải pass.

### Story 3.7: Giám sát click-processing pipeline

**Requirements:** FR-11, FR-16
Là một vận hành viên hệ thống,
Tôi muốn theo dõi API, worker và queue bằng structured telemetry,
Để tôi phát hiện processing lag, durability failure và privacy breach sớm.

**Acceptance Criteria:**

**Given** API và worker đang chạy
**When** observability pipeline thu thập dữ liệu
**Then** JSON logs có request/event correlation IDs
**And** có redirect/dashboard latency histograms, queue age/lag, retry/dead-letter, DB pool saturation, durability failure và worker heartbeat metrics.

**Given** worker không commit event trong freshness budget
**When** last-successful-commit hoặc queue age vượt 60 giây
**Then** worker freshness alert kích hoạt
**And** operational status không chỉ dựa vào process còn sống.

**Given** API/worker/proxy log request hoặc event
**When** sanitizer xử lý fields
**Then** không có raw IP, password, token, cookie, verification secret, full referrer hoặc full Destination query
**And** automated sanitization test phải pass.

**Given** PostgreSQL unavailable
**When** health endpoints được gọi
**Then** liveness vẫn phản ánh process
**And** readiness báo unavailable
**And** dependency failure có metric/correlation ID.

**Given** alerts được cấu hình
**When** SLO breach, dead letter, lost click, pool saturation hoặc freshness >60 giây xảy ra
**Then** alert chứa service, environment, metric và correlation context không có PII
**And** có documented recovery link/runbook reference.

**Given** CI chạy observability tests
**When** test metric emission, alert threshold, readiness/liveness và log sanitization
**Then** tất cả checks phải pass.

### Story 3.8: Triển khai Render Singapore và vận hành migration an toàn

**Requirements:** FR-10, FR-11
Là một vận hành viên hệ thống,
Tôi muốn web/API, worker và PostgreSQL được triển khai cùng region với migration/backup an toàn,
Để hệ thống có thể phục vụ marketing thật và phục hồi khi sự cố.

**Acceptance Criteria:**

**Given** Render environment được provision
**When** services được tạo
**Then** web/API và worker là hai services độc lập
**And** managed PostgreSQL dùng cùng Singapore region/private network
**And** cả hai process dùng internal DB URL và separate bounded pools.

**Given** deployment mới bắt đầu
**When** pre-deploy migration chạy
**Then** Drizzle migration lấy advisory lock
**And** migration tương thích N/N-1
**And** migration failure chặn traffic cutover/readiness
**And** API/worker chỉ ready sau schema compatibility check.

**Given** API hoặc worker nhận SIGTERM
**When** Render restart/deploy
**Then** process ngừng nhận work mới
**And** hoàn tất bounded in-flight work hoặc để lease phục hồi
**And** đóng DB/listener pools trước deadline
**And** hai services có thể restart độc lập.

**Given** production marketing use được bật
**When** operational readiness được xác nhận
**Then** automated backup/PITR phù hợp selected Render plan đã bật
**And** accepted RPO/RTO được ghi nhận
**And** ít nhất một restore drill hoàn tất thành công.

**Given** deployment configuration được kiểm tra
**When** CI/deploy gate chạy
**Then** region, private network, env validation, secret handling, migration command, health endpoints và build filters đều được xác minh
**And** không có fallback production secret.

**Given** rollback app version được yêu cầu
**When** schema mới đã apply
**Then** previous compatible app/worker version có thể chạy trên schema theo N/N-1 contract
**And** destructive schema rollback không được thực hiện tự động.

### Story 3.9: Benchmark redirect SLO

**Requirements:** FR-10, FR-11
Là một builder học system design,
Tôi muốn kiểm chứng redirect latency và durability ở tải mục tiêu,
Để tôi biết request path đạt NFR-1 thay vì chỉ giả định.

**Acceptance Criteria:**

**Given** production-like dataset có active, missing và tombstoned paths
**When** benchmark chạy 100 rps, 20 concurrent connections trong 10 phút
**Then** active-human redirect p95 không vượt 200 ms
**And** mỗi 302 tương ứng đúng một durable Click Event
**And** report có p50/p95/p99, throughput, errors, DB pool saturation và event-commit latency.

**Given** bot/link-preview traffic được trộn vào workload
**When** benchmark chạy
**Then** bot vẫn nhận 302 nhưng không tạo Click Event
**And** human reconciliation không bị ảnh hưởng.

**Given** enrichment chậm/lỗi được inject
**When** DB healthy
**Then** dimensions fallback `unknown`
**And** redirect vẫn nằm trong configured budget
**And** aggregation không chạy trên request thread.

**Given** lookup/pool/event commit failure được inject
**When** bounded retry thất bại
**Then** request trả 503, không redirect
**And** không có successful redirect without durable event
**And** failure metrics tăng.

**Given** benchmark fail SLO
**When** report được review
**Then** story không được done bằng cách nới SLO
**And** team tối ưu query/index/pool trước
**And** Redis chỉ được xem xét qua architecture update/new AD.

### Story 3.10: Kiểm chứng worker failure isolation và reconciliation

**Requirements:** FR-11, FR-16
Là một builder học system design,
Tôi muốn kiểm chứng worker restart, backlog và deploy failure isolation,
Để durable events luôn được xử lý đúng sau sự cố.

**Acceptance Criteria:**

**Given** worker bị dừng khi API/PostgreSQL còn healthy
**When** API tiếp tục nhận redirects
**Then** durable events vẫn được ghi và visitor nhận 302
**And** backlog nằm trong PostgreSQL
**And** freshness alert kích hoạt khi lag >60 giây.

**Given** worker khởi động lại
**When** polling resume
**Then** pending/expired-leased events được tìm thấy
**And** backlog xử lý không double-count
**And** aggregates reconcile 100% với unique human redirects.

**Given** worker crash ở trước/sau idempotency marker hoặc fact UPSERT
**When** event được reclaim
**Then** atomic transaction/unique marker ngăn partial/double aggregate
**And** stale lease token không commit.

**Given** API instance deploy/restart trong workload
**When** SIGTERM và cutover xảy ra
**Then** in-flight requests hoàn tất hoặc fail rõ ràng
**And** không có partial Click Event
**And** remaining instances/health checks duy trì routing đúng.

**Given** fault-injection run hoàn tất
**When** evidence report được tạo
**Then** report chứa queue lag, retry/dead-letter, reconciliation, shutdown outcome và alerts
**And** không chứa raw IP hoặc sensitive URLs
**And** artifact liên kết NFR-3, SM-8 và SM-9.

## Epic 4: Campaign analytics and optimization

Marketer có thể hiểu campaign nào hiệu quả hơn, so sánh 2–5 links và điều chỉnh channel/content dựa trên analytics.

### Story 4.1: Truy vấn total click và analytics summary

**Requirements:** FR-6 (completion — list total click), FR-13
Là một marketer,
Tôi muốn xem tổng click của từng Short Link,
Để tôi nhanh chóng biết campaign link nào đang tạo traffic.

**Acceptance Criteria:**

**Given** marketer sở hữu Short Link có processed Click Events
**When** worker đã aggregate events
**Then** daily dimensional facts chứa đúng click counts
**And** total click được tính từ aggregate facts
**And** query thông thường không scan raw Click Events.

**Given** marketer mở Links
**When** list API trả dữ liệu
**Then** mỗi active owned link hiển thị total click hiện tại
**And** query scope theo canonical `ActorId`
**And** không phát sinh N+1 query cho totals.

**Given** marketer mở Link detail
**When** summary API được gọi
**Then** response gồm Short Link metadata, total click và last processed/update time
**And** response dùng generated OpenAPI contract
**And** không chứa raw IP hoặc raw event rows.

**Given** link chưa có processed click
**When** summary được tính
**Then** total click bằng `0`
**And** UI hiển thị empty analytics state thay vì blank/broken metric
**And** không tạo fake trend.

**Given** link đã bị xóa/tombstoned
**When** marketer gọi summary endpoint
**Then** retained aggregates không được hiển thị trong dashboard MVP
**And** không trả Destination URL cũ hoặc analytics metadata.

**Given** Marketer A yêu cầu summary của link thuộc Marketer B
**When** use case xử lý request
**Then** repository scope theo owner
**And** không trả count, metadata hoặc existence signal
**And** không query facts ngoài owner scope.

**Given** processed Click Event được retry hoặc replay
**When** aggregate fact đã được increment trước đó
**Then** total không tăng lần hai
**And** total bằng số unique processed-event markers.

**Given** summary API đang tải
**When** Dashboard hoặc Link detail render
**Then** MetricCard skeleton giữ geometry
**And** main region/card có loading semantics phù hợp
**And** không layout jump.

**Given** summary API thất bại
**When** UI nhận network/server error
**Then** hiển thị recoverable error với Retry
**And** không thay bằng total `0`
**And** không trình bày stale value như dữ liệu mới.

**Given** total được hiển thị
**When** marketer dùng screen reader hoặc zoom
**Then** metric có label và locale-aware formatted value
**And** không dùng màu làm tín hiệu duy nhất
**And** dùng tabular numerals khi cần căn cột
**And** reflow hoạt động tại 320 CSS px.

**Given** CI chạy analytics summary integration tests
**When** test zero, one/many facts, duplicate replay, ownership, deleted link, no N+1 và raw-data isolation
**Then** tất cả scenario phải pass.

### Story 4.2: Hiển thị click trend theo ngày UTC

**Requirements:** FR-14
Là một marketer,
Tôi muốn xem xu hướng click theo ngày,
Để tôi biết campaign tăng hoặc giảm vào thời điểm nào.

**Acceptance Criteria:**

**Given** marketer mở analytics của owned Short Link
**When** không chọn date range khác
**Then** API dùng 30 ngày gần nhất theo UTC
**And** trả một bucket cho mỗi UTC date trong range
**And** ngày không có click có count `0`.

**Given** daily facts tồn tại cho nhiều dimension tuples cùng ngày
**When** trend query chạy
**Then** counts được cộng đúng theo link/day
**And** không scan raw Click Events
**And** historical UTM snapshot không bị tính lại từ Destination URL hiện tại.

**Given** marketer chọn Today, 7, 30, 90 ngày hoặc custom range
**When** query được gửi
**Then** range boundaries được normalize theo UTC
**And** response ghi rõ granularity/day và effective range
**And** invalid/reversed/oversized ranges trả RFC 9457 validation error.

**Given** trend có dữ liệu
**When** chart render
**Then** dùng line chart cho một series
**And** axis ghi rõ UTC/date granularity
**And** gridlines recessive, values locale-aware
**And** chart có text summary và captioned table chứa cùng dữ liệu.

**Given** trend không có click
**When** surface render
**Then** hiển thị “No clicks in this range.”
**And** giữ date filters
**And** không hiển thị empty axis như chart bị lỗi.

**Given** trend request loading hoặc refresh
**When** dữ liệu mới chưa hoàn tất
**Then** geometry được giữ bằng skeleton hoặc previous render giảm opacity
**And** không flash blank chart hoặc layout jump.

**Given** viewport nhỏ hoặc zoom 400%
**When** trend render
**Then** chart giảm tick density mà không xoay/truncate label khó đọc
**And** table fallback nằm trong labeled horizontal-scroll region nếu cần
**And** thông tin không phụ thuộc hover.

**Given** CI chạy trend tests
**When** test UTC boundaries, daylight-saving inputs, zero-fill, date presets, custom range, no data và table/chart parity
**Then** tất cả scenario phải pass.

### Story 4.3: Breakdown và filter analytics theo dimensions

**Requirements:** FR-15
Là một marketer,
Tôi muốn breakdown và filter click theo nguồn, vị trí, thiết bị, trình duyệt và UTM,
Để tôi hiểu traffic đến từ đâu và campaign segment nào hiệu quả.

**Acceptance Criteria:**

**Given** marketer mở Link detail analytics
**When** filter bar tải
**Then** có controls cho referrer, country, city, device, browser, `utm_source`, `utm_medium`, `utm_campaign`
**And** date range đứng trước dimension filters
**And** controls dùng generated API contract.

**Given** marketer chọn nhiều filters
**When** analytics query chạy
**Then** filters kết hợp bằng phép AND
**And** mọi KPI, trend, breakdown và table bên dưới dùng cùng data slice
**And** effective filters được phản ánh trong URL/router state.

**Given** daily facts có canonical `unknown`
**When** breakdown render
**Then** `unknown` là một category có label/helper text
**And** không bị bỏ âm thầm khỏi denominator hoặc total.

**Given** city data được hiển thị
**When** breakdown render
**Then** city có nhãn `Estimated`
**And** UI không dùng bản đồ hoặc copy ngụ ý độ chính xác tuyệt đối
**And** raw IP không có trong response/DOM.

**Given** breakdown có hơn 8 categories
**When** chart/table được tạo
**Then** 8 categories theo fixed series order được giữ
**And** phần còn lại gộp `Other`
**And** color không đổi theo rank/filter
**And** status colors không được dùng làm series semantics.

**Given** breakdown được hiển thị
**When** marketer dùng chart hoặc table
**Then** horizontal bars phục vụ magnitude comparison
**And** direct labels/table cho low-contrast marks
**And** tooltip không chứa thông tin độc quyền
**And** captioned data table có headers/scope tương ứng.

**Given** marketer xóa hoặc thay filter
**When** query refresh
**Then** các controls còn lại và scroll/context được giữ
**And** back/forward navigation phục hồi filter state
**And** totals giữa cards vẫn reconcile.

**Given** Marketer A cố filter analytics cho link của Marketer B
**When** API xử lý query
**Then** ownership được enforce trong use case/repository
**And** không trả categories/count/existence signal ngoài owner scope.

**Given** CI chạy dimensional-query suite
**When** test từng dimension, AND combinations, `unknown`, `Other`, ownership, URL state và chart/table parity
**Then** tất cả scenario phải pass.

### Story 4.4: Refresh analytics và freshness states

**Requirements:** FR-16
Là một marketer,
Tôi muốn refresh analytics và hiểu độ mới của dữ liệu,
Để tôi không nhầm dữ liệu xử lý chậm với click bị mất.

**Acceptance Criteria:**

**Given** analytics đã tải
**When** marketer chọn Refresh
**Then** request mới dùng date/filter context hiện tại
**And** previous data vẫn hiển thị ở reduced opacity
**And** refresh button có loading state và ngăn duplicate request
**And** không gây layout jump.

**Given** refresh thành công
**When** response được nhận
**Then** cards/charts/tables cập nhật atomically cho cùng snapshot
**And** `Last updated` hiển thị thời điểm mới
**And** UI nói dữ liệu có thể trễ tối đa 60 giây
**And** polite live region công bố hoàn tất mà không lặp announcement.

**Given** valid Click Event vừa được ghi
**When** worker hoạt động trong load envelope
**Then** click xuất hiện trong analytics trong tối đa 60 giây
**And** count/trend/breakdown reconcile với event sau processing.

**Given** refresh thất bại
**When** API/network error xảy ra
**Then** previous data được giữ và đánh dấu chưa cập nhật
**And** UI hiển thị “Couldn’t refresh. Try again.”
**And** cung cấp Retry
**And** không thay lỗi bằng empty analytics.

**Given** worker lag vượt 60 giây
**When** analytics response cho biết freshness degraded
**Then** UI hiển thị warning rõ ràng
**And** không claim realtime/current data
**And** warning có text/icon, không dựa vào màu.

**Given** session hết hạn trong refresh
**When** API trả `401`
**Then** UI yêu cầu Sign in lại và giữ intended route/filter context
**And** không hiển thị unauthorized data mới.

**Given** filter/date thay đổi trong khi refresh cũ còn chạy
**When** responses về khác thứ tự
**Then** stale response không ghi đè query mới hơn
**And** UI hiển thị data đúng với visible controls.

**Given** CI chạy freshness tests
**When** test success, 60-second boundary, worker lag, network error, stale-response race, session expiry và live announcements
**Then** tất cả scenario phải pass.

### Story 4.5: So sánh 2–5 campaign links

**Requirements:** FR-13, FR-14, FR-15, FR-16
Là một marketer,
Tôi muốn so sánh từ 2 đến 5 Short Links với cùng filters,
Để tôi xác định channel hoặc campaign link hiệu quả hơn.

**Acceptance Criteria:**

**Given** marketer ở Links và chọn 2–5 owned links
**When** họ chọn Compare
**Then** Compare Links mở với selected IDs trong shareable/restorable router state
**And** default range là 30 ngày
**And** mọi link được authorization trong một owner-scoped query.

**Given** marketer chọn dưới 2, trên 5, duplicate hoặc link không thuộc tài khoản
**When** compare request được xử lý
**Then** request bị từ chối hoặc control không kích hoạt
**And** API không trả metadata/count của unauthorized links
**And** không phát sinh N+1 query.

**Given** comparison tải thành công
**When** surface render
**Then** hiển thị per-link total KPI, daily trend và dimension/UTM breakdown
**And** shared date/filter bar áp dụng đồng nhất cho tất cả links
**And** từng Short Link có label/identity ổn định khi filter thay đổi.

**Given** hai campaign links dùng `utm_medium=email` và `utm_medium=paid-social`
**When** Linh xem comparison
**Then** họ xác định được link/channel có nhiều click hơn từ seeded data
**And** exact counts có trong adjacent table
**And** conclusion không phụ thuộc referrer có thể thiếu.

**Given** một selected link không có click trong range
**When** comparison render
**Then** link vẫn hiển thị với count `0`
**And** không bị loại khỏi legend/table
**And** comparison totals vẫn nhất quán.

**Given** selected link bị xóa hoặc quyền sở hữu thay đổi trước query
**When** Compare refresh
**Then** link đó không lộ retained aggregate
**And** UI giải thích item unavailable và cho phép bỏ khỏi selection
**And** các link hợp lệ còn lại chỉ tiếp tục comparison nếu còn ít nhất 2.

**Given** viewport dưới 768px hoặc 320 CSS px
**When** comparison render
**Then** cards/charts stack theo chiều dọc
**And** comparison table nằm trong labeled horizontal-scroll region
**And** filters vào drawer có active-count badge
**And** mọi action đạt 44×44px.

**Given** CI chạy Compare Links suite
**When** test 2–5 links, bounds, ownership, zero data, deleted link, shared filters, stable identity, mobile layout và seeded-channel decision
**Then** tất cả scenario phải pass.

### Story 4.6: Accessible responsive analytics visualization

**Requirements:** FR-13, FR-14, FR-15, FR-16
Là một marketer dùng nhiều thiết bị hoặc assistive technology,
Tôi muốn analytics dễ đọc và vận hành bằng keyboard/screen reader,
Để tôi có thể hiểu campaign data mà không phụ thuộc màu, hover hoặc desktop.

**Acceptance Criteria:**

**Given** analytics UI được triển khai
**When** visual tokens được kiểm tra
**Then** dùng chính xác semantic colors, typography, spacing, radii và focus ring từ `DESIGN.md`
**And** normal text/controls đạt WCAG 2.2 AA contrast target
**And** chart series không reuse status semantics.

**Given** chart có một hoặc nhiều series
**When** data render
**Then** daily trend dùng line form, magnitude breakdown dùng horizontal bars
**And** series identity dùng fixed color order cộng direct label/table
**And** không có dual axis, rainbow palette hoặc hue thứ chín.

**Given** keyboard hoặc screen reader được dùng
**When** marketer duyệt analytics
**Then** chart là nonessential visual summary
**And** adjacent table là primary accessible data path
**And** table có caption, headers, `scope` và locale-aware values
**And** mọi filter/action là native control.

**Given** tooltip được cung cấp cho pointer
**When** hover/focus vào chart container
**Then** tooltip chỉ bổ sung dữ liệu đã tồn tại ở label/table
**And** có thể dismiss/không che nội dung quan trọng
**And** không yêu cầu precision target nhỏ.

**Given** page được dùng ở 320 CSS px, 400% zoom hoặc 200% text spacing
**When** analytics surfaces reflow
**Then** không có two-dimensional page scroll
**And** chỉ labeled data-table regions được scroll ngang
**And** focused elements không bị header/overlay che.

**Given** `prefers-reduced-motion` được bật
**When** loading/refresh/navigation diễn ra
**Then** shimmer/smooth-scroll/decorative transitions bị tắt hoặc giảm
**And** feedback tĩnh tương đương vẫn hiển thị
**And** comprehension không phụ thuộc animation.

**Given** modal, drawer hoặc filter popover mở
**When** user tương tác
**Then** initial focus, modal containment, inert background, Escape/Close và focus return tuân UX contract
**And** controls công bố expanded/selected/disabled states.

**Given** key screens được visual regression test
**When** so sánh Dashboard/Create Link với mock references
**Then** DESIGN/EXPERIENCE spine thắng nếu mock khác
**And** tests bao phủ desktop/tablet/mobile, long text, `unknown`, errors và empty states.

**Given** accessibility verification chạy
**When** automated checks và manual keyboard/screen-reader/zoom review hoàn tất
**Then** không có critical/serious accessibility violation chưa xử lý
**And** evidence được lưu trước release.

### Story 4.7: Benchmark dashboard analytics

**Requirements:** FR-13, FR-14, FR-15
Là một builder học system design,
Tôi muốn kiểm chứng dashboard nhanh và chính xác ở tải mục tiêu,
Để tôi biết analytics queries đạt NFR-2 thay vì chỉ giả định.

**Acceptance Criteria:**

**Given** production-like PostgreSQL có 100.000 analytics facts trong 30-day range
**When** 20 concurrent dashboard requests chạy sau warm-up
**Then** dashboard API p95 không vượt `2 giây`
**And** report chứa p50/p95/p99, error rate, query count và DB pool saturation
**And** query không scan raw Click Events hoặc tạo N+1.

**Given** benchmark dùng total, daily, từng dimension, multi-filter và Compare queries
**When** kết quả được đo
**Then** query plans sử dụng indexes/composite keys phù hợp
**And** counts giữa summary, charts và tables reconcile
**And** custom ranges ngoài NFR envelope được ghi rõ là best-effort.

**Given** database pool saturation hoặc query failure được inject
**When** dashboard request/refresh chạy
**Then** API fail trong bounded timeout
**And** UI giữ previous data, hiển thị error/Retry rõ ràng
**And** stale data không được trình bày như fresh
**And** telemetry có correlation ID nhưng không có PII.

**Given** benchmark không đạt p95 hoặc reconciliation
**When** report được review
**Then** story không được đánh dấu done bằng cách nới NFR
**And** query/index/pool bottleneck được sửa và benchmark lại
**And** architecture chỉ thay đổi khi evidence yêu cầu.

**Given** benchmark hoàn tất
**When** evidence được lưu
**Then** workload, seed, warm-up, runtime, query plans và raw results đủ để tái lập
**And** artifact liên kết NFR-2 và SM-9
**And** không chứa raw IP, secrets hoặc sensitive Destination URLs.

### Story 4.8: Xác thực usability cho campaign decision loop

**Requirements:** FR-4, FR-5, FR-12, FR-13, FR-15
Là một product owner,
Tôi muốn xác thực marketer tự tạo và so sánh campaign links,
Để biết workflow giải quyết được nhiệm vụ thực thay vì chỉ hoạt động kỹ thuật.

**Acceptance Criteria:**

**Given** seeded dataset chứa email và paid-social links với counts khác nhau
**When** marketer thực hiện usability task không có hỗ trợ kỹ thuật
**Then** họ tạo được hai campaign links với UTM đúng
**And** chọn đúng 2 links để Compare
**And** xác định đúng channel có nhiều click hơn
**And** kết quả được chấm theo rubric của SM-7.

**Given** analytics có `unknown`, estimated city, zero-filled dates và delayed freshness
**When** marketer đọc Dashboard/Compare
**Then** họ giải thích đúng từng state
**And** không nhầm unknown/estimated/delay thành system failure, exact location hoặc realtime data.

**Given** marketer thực hiện task bằng keyboard, screen reader hoặc viewport 320 CSS px
**When** workflow đi qua Create Link, Links và Compare
**Then** mọi action chính hoàn tất không phụ thuộc hover, màu hoặc chart tooltip
**And** chart-table parity cho phép xác định cùng kết luận
**And** không có critical/serious accessibility blocker.

**Given** usability criterion thất bại
**When** finding được triage
**Then** copy, interaction hoặc accessibility issue được sửa và task chạy lại
**And** không hạ rubric SM-7 để đánh dấu done
**And** evidence ghi rõ participant profile, task, outcome và giới hạn.

### Epic 4 Release Readiness Checklist

Checklist này không phải implementation story, không có story estimate/status và chỉ chạy sau Stories 4.1–4.8. Sprint Planning quản lý checklist như Epic Definition of Done.

- [ ] Unit, integration, Playwright E2E, accessibility, visual regression, performance và reconciliation checks đều pass trên supported CI/Linux, WSL hoặc Windows 11; Windows 10 local không phải acceptance evidence.
- [ ] `AppShell`, `PrimaryButton`, `MetricCard`, `FilterBar`, `ChartCard`, `LinkTable`, `Toast/Banner`, `Dialog`, `ErrorSummary`, `EmptyState` và `FocusIndicator` tuân cùng DESIGN/EXPERIENCE contract; không có duplicate component khác semantics.
- [ ] SM-9 demo giải thích redirect path, durable capture, lease fencing, idempotency, aggregation, retention, ownership, CSRF, failure isolation, PostgreSQL source-of-truth, no-cache MVP và measured upgrade trigger.
- [ ] Benchmark, security, accessibility, restore-drill và usability artifacts được liên kết.
- [ ] FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15 và FR-16 có passing story/test/evidence.
- [ ] NFR-1–NFR-16 và UX-DR1–UX-DR24 có passing evidence matrix.
- [ ] Không có secret, raw IP hoặc sensitive URL trong artifacts.
- [ ] Không có ignored hoặc unresolved phase-blocking failure.

### Sprint Planning Sizing Gate

Trước khi schedule Stories 3.2, 3.4, 4.3 hoặc 4.5, phải estimate implementation breadth theo một dev-agent context. Nếu story chứa nhiều hơn một independently testable vertical slice hoặc không thể hoàn tất trong một story cycle, Sprint Planning phải tách story trong khi giữ backward-only dependencies và toàn bộ acceptance coverage gốc.
