---
title: Implementation Readiness Assessment Report
project: url_shortener_system
date: 2026-07-19
status: final
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
includedDocuments:
  prd:
    - prds/prd-url_shortener_system-2026-07-19/prd.md
  architecture:
    - architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md
  epics:
    - epics.md
  ux:
    - ux-designs/ux-url_shortener_system-2026-07-19/DESIGN.md
    - ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-19
**Project:** url_shortener_system

## 1. Document Inventory

### PRD

- `prds/prd-url_shortener_system-2026-07-19/prd.md` — 21,948 bytes; updated 2026-07-19 18:11:55.

### Architecture

- `architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md` — 21,584 bytes; updated 2026-07-19 20:48:26.
- Supporting artifacts: `C4-DIAGRAMS.md`, `.memlog.md`, `reviews/review-adversarial-seams.md`, `reviews/review-data-integrity.md`.

### Epics & Stories

- `epics.md` — 114,258 bytes; updated 2026-07-19 22:42:10.

### UX

- `ux-designs/ux-url_shortener_system-2026-07-19/DESIGN.md` — 6,124 bytes; updated 2026-07-19 18:46:03.
- `ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md` — 14,203 bytes; updated 2026-07-19 18:46:04.
- Supporting artifacts: key-screen mockups, UX reviews và `.memlog.md`.

### Discovery Findings

- Không có whole/sharded duplicate.
- Không thiếu PRD, Architecture, Epics hoặc UX spine.
- Không có `project-context.md`; assessment dùng planning artifacts làm nguồn chính.

## 2. PRD Analysis

### Functional Requirements

- **FR-1 — Email/password sign up và sign in:** Marketer có thể tạo tài khoản và đăng nhập bằng email/password. Dashboard bị chặn khi chưa đăng nhập; email phải hợp lệ và xác minh; password theo security policy; credential error không tiết lộ email tồn tại.
- **FR-2 — Google OAuth sign in:** Marketer có thể đăng nhập bằng Google OAuth. Provider là Google; flow thành công không collision vào dashboard; email collision không tạo/login account mới và yêu cầu email/password sign-in rồi re-authenticated linking; cancel/failure quay lại Sign in với lỗi.
- **FR-3 — Session và account lifecycle:** Marketer chỉ xem/quản lý Short Link thuộc tài khoản mình và có thể kết thúc session. Không authenticated thì không vào dashboard; ownership isolation; logout/session expiry; account linking chỉ sau verified email và re-authentication; password reset ngoài MVP và Sign in phải nêu giới hạn.
- **FR-4 — Create short link:** Marketer tạo Short Link bằng Destination URL `http`/`https`; Alias trống thì sinh Code; link mới xuất hiện trong danh sách.
- **FR-5 — Custom alias:** Marketer nhập Alias tùy chỉnh global. Alias không trùng Code, Reserved Path hoặc Tombstone; normalize lowercase; dài 3–64; chỉ `a-z`, `0-9`, `-`; không có hyphen đầu/cuối; invalid/collision không tạo link và hiển thị lỗi.
- **FR-6 — Link list:** Marketer xem danh sách Short Link của mình; mỗi item có short path, destination URL, ngày tạo và tổng click; chỉ dữ liệu của account hiện tại.
- **FR-7 — Edit destination URL:** Marketer sửa Destination URL của Short Link mình sở hữu; short path giữ nguyên; URL mới phải là `http`/`https`; analytics cũ giữ cùng link.
- **FR-8 — Delete short link:** Marketer xóa Short Link mình sở hữu; link biến mất khỏi dashboard; path trả 404, không redirect cũ; Tombstone vĩnh viễn; aggregate giữ theo retention nhưng ẩn, raw log tối đa 30 ngày.
- **FR-9 — Rate limit link creation:** Giới hạn tạo Short Link theo account; vượt ngưỡng trả 429, không tạo dữ liệu và thông báo thời gian thử lại; threshold thuộc architecture/configuration.
- **FR-10 — Public redirect:** Visitor mở `/{Code}` hoặc `/{Alias}` và được redirect tới destination hiện tại; missing path không redirect ngoài; không yêu cầu auth.
- **FR-11 — Click event capture:** Mỗi redirect request hợp lệ tạo một Click Event, không deduplicate visitor; bot/preview vẫn redirect nhưng không event; retry idempotent; event có Short Link, UTC timestamp, effective UTM snapshot và dimensions; enrichment thiếu dùng `unknown` và không làm redirect fail.
- **FR-12 — Build UTM parameters:** Marketer nhập `utm_source`, `utm_medium`, `utm_campaign`; xem final preview; redirect giữ UTM; casing/internal-space warning không block; trim outer space, preserve casing, percent-encode; duplicate UTM được thay thế, query/fragment khác được giữ.
- **FR-13 — Link analytics summary:** Marketer xem tổng click từng Short Link trên list và detail; total tăng sau event processing.
- **FR-14 — Analytics by day:** Marketer xem click theo ngày UTC; mặc định 30 ngày; zero-fill ngày không click.
- **FR-15 — Analytics breakdowns:** Marketer breakdown/filter theo referrer, country, city, device, browser và ba UTM dimensions; dùng event-time UTM snapshot; edit chỉ ảnh hưởng click tương lai; filter AND; location estimated; `unknown` rõ ràng; không hiển thị raw IP.
- **FR-16 — Refresh on request:** Marketer refresh analytics mà giữ filter/context; không realtime; valid click xuất hiện trong tối đa 60 giây ở tải MVP; UI có Last updated và lag warning.

**Tổng FR:** 16.

### Non-Functional Requirements

- **NFR-1:** Redirect p95 ≤200 ms tại 100 rps, 20 concurrent connections trong 10 phút; analytics enrichment không chặn redirect.
- **NFR-2:** Dashboard p95 ≤2 giây với 100.000 Click Events trong range 30 ngày và 20 concurrent requests sau warm-up.
- **NFR-3:** Valid click xuất hiện trong analytics ≤60 giây trong load envelope NFR-1/NFR-2.
- **NFR-4:** Dashboard/link management yêu cầu session; cookie `HttpOnly`, `Secure` production và `SameSite` phù hợp.
- **NFR-5:** Password dùng password hashing phù hợp; không plaintext/reversible encryption.
- **NFR-6:** Login rate limit và error không account enumeration.
- **NFR-7:** Mọi mutation có CSRF protection hoặc tương đương framework.
- **NFR-8:** Destination URL chỉ nhận `http`/`https`.
- **NFR-9:** Short Path Namespace chặn Reserved Path, collision và invalid characters.
- **NFR-10:** OAuth kiểm tra `state` và OIDC `nonce`.
- **NFR-11:** Analytics aggregate-first; không cross-site user profiling.
- **NFR-12:** Raw click log xóa tối đa 30 ngày; aggregates giữ không thời hạn trong MVP cho active links; deleted-link aggregates giữ nhưng ẩn.
- **NFR-13:** Dashboard không hiển thị raw IP.
- **NFR-14:** City-level location được mô tả là estimated.
- **NFR-15:** Redirect không fail chỉ vì không parse được referrer/device/browser/location.
- **NFR-16:** Deleted link trả 404, giữ Tombstone và không redirect destination cũ.

**Tổng NFR:** 16.

### Additional Requirements and Constraints

- Web dashboard; email/password và Google OAuth; ownership theo account; không admin UI/complex RBAC trong MVP.
- Global Short Path Namespace; existing Short Path thắng route thêm sau; route mới phải tránh collision.
- Aggregate-first privacy boundary; không tối ưu analytics bằng raw personal data.
- Success gates gồm redirect correctness 100% trong manual/E2E, analytics reconciliation 100% trong 60 giây, benchmark NFR-1–NFR-3, security evidence NFR-4–NFR-10 và task usability SM-7.
- Out of scope: custom domain, team workspace, QR, bulk creation, public API, A/B routing, password-protected links, expiration, integrations, billing, realtime analytics, password reset.
- Deep phishing/malware detection ngoài MVP; baseline abuse controls là validation và create-link rate limiting.
- Không còn open question hoặc assumption chặn phase tiếp theo.

### PRD Completeness Assessment

PRD có 16 FR và 16 NFR được đánh số ổn định, consequences testable, scope/non-goals rõ và success metrics nối trực tiếp với requirements. Một điểm cần kiểm tra ở các bước sau: PRD sequencing guidance đặt link model/redirect trước authentication, trong khi epic dependency đặt authentication trước link management; đây có thể chỉ là guidance không binding nhưng phải được đối chiếu với Architecture và stories.

## 3. Epic Coverage Validation

### Epic FR Coverage Extracted

- FR-1 → Epic 1; stories 1.1, 1.2, 1.3, 1.4, 1.5.
- FR-2 → Epic 1; stories 1.1, 1.2, 1.3, 1.6, 1.7.
- FR-3 → Epic 1; stories 1.1, 1.2, 1.3, 1.5, 1.7.
- FR-4 → Epic 2; stories 2.1, 2.8.
- FR-5 → Epic 2; story 2.2.
- FR-6 → Epic 2; stories 2.4, 2.5.
- FR-7 → Epic 2; story 2.6.
- FR-8 → Epic 2; stories 2.7, 2.9.
- FR-9 → Epic 2; story 2.8.
- FR-10 → Epic 3; stories 3.1, 3.2, 3.3, 3.8, 3.9.
- FR-11 → Epic 3; stories 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10.
- FR-12 → Epic 2; story 2.3.
- FR-13 → Epic 4; story 4.1.
- FR-14 → Epic 4; story 4.2.
- FR-15 → Epic 4; story 4.3.
- FR-16 → Epic 4; stories 3.7, 3.10, 4.4.

**Tổng FR trong epics:** 16.

### Coverage Matrix

| FR | PRD requirement | Epic/story coverage | Status |
|---|---|---|---|
| FR-1 | Email/password sign up/sign in, verification, generic errors | Epic 1: 1.1–1.5 | ✓ Covered |
| FR-2 | Google OAuth, collision-safe linking | Epic 1: 1.1–1.3, 1.6–1.7 | ✓ Covered |
| FR-3 | Session lifecycle and ownership isolation | Epic 1: 1.1–1.3, 1.5, 1.7 | ✓ Covered |
| FR-4 | Create link and generated Code | Epic 2: 2.1, 2.8 | ✓ Covered |
| FR-5 | Global custom Alias rules | Epic 2: 2.2 | ✓ Covered |
| FR-6 | Owned link list | Epic 2: 2.4–2.5 | ✓ Covered |
| FR-7 | Edit destination URL | Epic 2: 2.6 | ✓ Covered |
| FR-8 | Delete, 404, Tombstone and hidden aggregate policy | Epic 2: 2.7, 2.9; Epic 3: 3.1; Epic 4: 4.1 | ✓ Covered |
| FR-9 | Link creation rate limit | Epic 2: 2.8 | ✓ Covered |
| FR-10 | Public redirect | Epic 3: 3.1–3.3, 3.8–3.9 | ✓ Covered |
| FR-11 | Durable click capture and idempotency | Epic 3: 3.2–3.10 | ✓ Covered |
| FR-12 | UTM builder | Epic 2: 2.3 | ✓ Covered |
| FR-13 | Total click analytics | Epic 4: 4.1 | ✓ Covered |
| FR-14 | Daily UTC analytics | Epic 4: 4.2 | ✓ Covered |
| FR-15 | Dimensional breakdown/filter | Epic 4: 4.3 | ✓ Covered |
| FR-16 | Request refresh and freshness | Epic 4: 4.4; Epic 3: 3.7, 3.10 | ✓ Covered |

### Missing Requirements

Không phát hiện FR nào bị thiếu. Một số FR trải qua nhiều epic do cross-cutting behavior: FR-8 nối mutation/public route/analytics visibility; FR-11 nối capture/worker/retention; FR-16 nối pipeline freshness/UI refresh.

### Coverage Statistics

- Total PRD FRs: 16
- FRs covered in epics: 16
- Coverage: 100%

### Scope Note

Epic-level coverage đầy đủ. Tuy nhiên, NFRs, Additional Requirements và UX-DRs cần được kiểm tra riêng ở các bước tiếp theo; FR coverage không tự chứng minh implementation readiness.

## 4. UX Alignment Assessment

### UX Document Status

**Found — final:**

- `ux-designs/ux-url_shortener_system-2026-07-19/DESIGN.md`
- `ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md`
- Hai key-screen mockups cho Dashboard analytics và Create Link.

### UX ↔ PRD Alignment

**Aligned:**

- Auth surfaces bao phủ email/password, Google OAuth, verification, collision, re-authenticated linking, session expiry và password-reset out-of-scope.
- IA bao phủ toàn bộ MVP jobs: Create, Links, Detail, Edit, Delete, Dashboard, Compare, Account, redirect và public 404.
- UJ-1/UJ-2 mirror PRD journeys; UX bổ sung UJ-3 để đóng account-collision flow đã có trong FR-2/FR-3.
- UTM builder, alias collision, ownership, deletion/Tombstone, request refresh, 60-second freshness, `unknown`, estimated city và no raw IP khớp FR-4–FR-16.
- UX mở rộng PRD bằng Compare Links, responsive breakpoints, WCAG 2.2 AA, table-backed charts, detailed states và interaction rules; các phần này đã được ghi thành UX-DR1–UX-DR24 trong `epics.md`.

### UX ↔ Architecture Alignment

**Supported:**

- Same-origin React SPA + NestJS static host hỗ trợ cookie/session và route refresh without CORS divergence.
- Generated OpenAPI client hỗ trợ Data Mode loaders/actions và ngăn frontend/backend DTO drift.
- PostgreSQL aggregates với full dimension tuple hỗ trợ AND filters, date ranges và Compare 2–5 links mà không scan raw events.
- Stable categorical identity, table fallback và responsive chart behavior thuộc frontend; Architecture cung cấp ECharts seed và typed aggregate responses.
- Request freshness được hỗ trợ bằng worker queue/metrics; dashboard p95 và 60-second budget có operational envelope và benchmark stories.
- Mutation idempotency/expected version hỗ trợ UX timeout reconciliation cho create/edit/delete.
- Ownership trong use case hỗ trợ Link detail, Dashboard và Compare không cross-account leakage.

### Alignment Issues

1. **HIGH — Create-success action conflict.** `EXPERIENCE.md:111,145` bắt buộc explicit **“View analytics”** sau create. Trong quá trình loại forward dependency, Story 2.1/2.5 đổi action thành **“View link details”** (`epics.md:693,967`). `DESIGN/EXPERIENCE` là spine thắng khi xung đột; Story 2.1 hiện không thực hiện đúng UX contract. Cần hoặc:
   - giữ “View analytics” nhưng render Link detail shell/empty analytics state không phụ thuộc Epic 4, rồi Epic 4 bổ sung dữ liệu; hoặc
   - cập nhật UX spine có chủ đích nếu product quyết định đổi hành vi.

2. **MEDIUM — Invalid URL submit-state conflict trong chính UX.** `EXPERIENCE.md:66` nói submit vẫn operable để discover all errors; `EXPERIENCE.md:88` nói submit disabled until corrected. Story 2.1 dùng operable submit + submit validation. Cần chọn một rule duy nhất; khuyến nghị Component Pattern thắng State Pattern vì hỗ trợ accessible error discovery.

3. **MEDIUM — Operator-facing UI ngoài PRD/UX surface model.** Story 2.9 thêm authenticated operator endpoint và owner-facing disabled state, trong khi PRD nói không admin UI và UX IA không có operator surface/disabled-by-policy state. Architecture chỉ yêu cầu operator-configured denylist. Backend-only operation có thể phù hợp, nhưng owner-visible disabled state/copy và operator authentication contract cần được ghi rõ là operational interface, không phải hidden new product role.

### Warnings

- Compare Links là UX-derived capability không có FR riêng, nhưng được trace trong Stories 4.5/4.8 và không mâu thuẫn PRD UJ-1/SM-7.
- DESIGN dùng system font có chủ đích, không có delivery risk; contrast exceptions cho chart marks được bù bằng direct labels/table.
- UX target WCAG 2.2 AA cần implementation testing; Stories 4.6/4.9 đã yêu cầu evidence.

## 5. Epic Quality Review

### Epic Structure

| Epic | User value | Independence | Verdict |
|---|---|---|---|
| Epic 1 — Secure marketer workspace | Marketer đăng ký, xác minh, đăng nhập và quản lý identity/session | Đứng độc lập trên bootstrap | Pass, nhưng foundation stories thiên kỹ thuật |
| Epic 2 — Create and manage campaign links | Marketer tạo, tìm, copy, sửa và xóa links | Có thể chạy với Epic 1 | Pass với một UX conflict và một operator-scope concern |
| Epic 3 — Reliable public sharing and click capture | Visitor redirect đúng; marketer có durable click substrate | Dùng outputs Epic 1–2, không cần Epic 4 | Pass |
| Epic 4 — Campaign analytics and optimization | Marketer xem, filter, compare và ra quyết định campaign | Dùng aggregates Epic 3 | Pass |

### Critical Violations

1. **Create-success action violates binding UX spine.** Story 2.1/2.5 đổi “View analytics” thành “View link details”, trong khi UX spine bắt buộc “View analytics”. Đây không phải forward dependency bắt buộc: Epic 2 có thể route tới Link detail với empty analytics placeholder/shell, còn Epic 4 bổ sung data. Cần sửa trước sprint planning.

### Major Issues

1. **Story 2.4 chưa tự hoàn thành FR-6.** PRD FR-6 yêu cầu mỗi list item có total click, nhưng Story 2.4 chỉ hiển thị path/destination/date và ghi total được Story 4.1 bổ sung. Traceability map vẫn đánh dấu Story 2.4 là FR-6 dù AC không hoàn thành toàn bộ FR. Epic 2 vẫn independently useful, nhưng story-level claim quá rộng. Remediation: ghi `FR-6 (partial: list metadata/ownership)` hoặc chuyển FR-6 completion claim sang Story 4.1 và nói rõ dependency là requirement split, không feature dependency.

2. **Story 2.9 tạo operator actor vượt product scope.** Story dùng authenticated operator identity, `link:disable` permission, endpoint và owner-visible disabled state. PRD nói không admin UI/complex RBAC; Architecture chỉ nói operator-configured denylist. Nếu giữ story, phải định nghĩa tối thiểu operator interface là deployment/CLI-only, credential source và không có admin UI. Nếu không, giảm story thành config-driven denylist enforced trong link mutation/redirect.

3. **Story 4.9 là release gate, không phải independently deliverable user story.** Nó gom validation suite, component inventory, system-design demo và traceability audit. Đây là milestone/evidence checklist hợp lệ cho project học system design nhưng không nên nằm trong normal Dev Story cycle. Remediation: chuyển thành release-readiness checklist/Definition of Done hoặc giữ loại `enabler/release gate` được sprint planning xử lý riêng.

4. **Nhiều stories vẫn lớn cho một dev-agent context.** Đặc biệt 3.2 (bot + GeoIP + UA + trusted proxy + privacy), 3.4 (queue state machine + LISTEN/NOTIFY + shutdown), 4.3 (query + filters + charts + accessibility), 4.5 (compare API + router + visualization + responsive). Acceptance criteria rõ nhưng implementation có thể vượt một story cycle. Remediation: sprint planning cần estimate; nếu vượt context, tách vertical slices mà không tạo forward dependency.

### Minor Concerns

1. **Story role quality:** 1.2, 3.8–3.10, 4.7–4.9 dùng builder/operator/product owner, phù hợp enabler/evidence nhưng không trực tiếp marketer value. Epic goals vẫn user-centric, nên không phải technical-epic violation.
2. **FR range notation:** Story 4.9 dùng `FR-1–FR-16`, trong khi tooling traceability có thể chỉ parse explicit IDs. Release evidence nên dùng generated matrix, không dựa vào range string.
3. **Story format:** mỗi heading có `Requirements`, narrative và BDD AC; không có vague happy path. Error, concurrency, privacy, a11y và failure conditions nhìn chung đầy đủ.
4. **Database timing:** schema được tạo khi capability cần: Better Auth ở 1.3, namespace/link ở 2.1/2.2, click queue/facts ở Epic 3. Không thấy “all tables upfront”.
5. **Starter:** Architecture không chỉ định starter repository cụ thể; Story 1.1 bootstrap monorepo/version seed là đủ, không có missing clone requirement.

### Dependency Analysis

- Epic order `1 → 2 → 3 → 4` hợp lý với identity → links → click capture → analytics.
- Không còn forward dependency trực tiếp khiến Epic 2 cần code Epic 3/4 để CRUD hoạt động.
- Các câu “retained visibility do Epic 4” và “total click bổ sung bởi Story 4.1” là deferred requirement completion, không runtime dependency; vẫn cần làm rõ traceability.
- Within-epic ordering nhìn chung hợp lệ: bootstrap/contracts trước auth; generated Code trước custom Alias/UTM/list/edit/delete; redirect trước enrichment/capture/worker/retention; summary/trend/filter trước refresh/compare/a11y/benchmarks.

### Best-Practice Compliance Summary

- User-value epics: 4/4 pass.
- FR traceability: 16/16 epic-level pass; one partial story-level claim on FR-6.
- Forward dependency: no runtime blocker found.
- BDD/testability: pass.
- Story sizing: concerns on four stories.
- Release-gate classification: requires cleanup for Story 4.9.

## 6. Summary and Recommendations

### Overall Readiness Status

## NEEDS WORK

Planning artifacts có nền tảng mạnh: PRD/UX/Architecture đều final, FR coverage đạt 100%, epic order hợp lý, AC chi tiết và Architecture có operational evidence. Tuy nhiên, một xung đột với binding UX spine và ba vấn đề scope/traceability cần sửa trước Sprint Planning. Chưa nên bắt đầu Dev Story trực tiếp.

### Critical Issues Requiring Immediate Action

1. **HIGH — Khôi phục hoặc chính thức thay đổi “View analytics” sau create.** UX spine yêu cầu action này tại `EXPERIENCE.md:111,145`; Stories 2.1/2.5 dùng “View link details”. Khuyến nghị tối thiểu: Story 2.1 giữ “View analytics” và route tới Link detail analytics shell/empty state; Story 4.1+ điền actual totals/charts. Cách này giữ UX contract mà không tạo runtime dependency.

2. **HIGH — Làm rõ FR-6 split.** FR-6 yêu cầu total click trong list; Story 2.4 claim FR-6 nhưng deferred total tới 4.1. Sửa traceability thành:
   - Story 2.4: `FR-6 (partial — metadata, ownership, search)`;
   - Story 4.1: `FR-6 (completion — total click)`, `FR-13`.
   Điều này không đổi epic order, chỉ làm claim trung thực.

3. **HIGH — Quyết định scope Story 2.9.** Chọn một trong hai:
   - **Khuyến nghị:** operator denylist là config/CLI-only operational control, không admin UI/RBAC product; ghi rõ credential/runbook và giữ owner generic disabled state;
   - hoặc thêm operator role/interface vào PRD và UX. Không triển khai một hidden auth model chưa có contract.

### Recommended Next Steps

1. Chạy `bmad-correct-course` để sửa đồng bộ `EXPERIENCE.md`/`epics.md`, hoặc chỉnh trực tiếp ba điểm HIGH rồi chạy Implementation Readiness lại.
2. Chuyển Story 4.9 thành release-readiness checklist/Definition of Done thay vì normal implementation story; giữ evidence requirements không đổi.
3. Trong Sprint Planning, estimate Stories 3.2, 3.4, 4.3, 4.5; tách nếu vượt một dev-agent context.
4. Giải quyết UX internal conflict về invalid URL: submit operable + validate on submit nên là rule authoritative; bỏ “submit disabled until corrected”.
5. Sau khi corrections hoàn tất, rerun `bmad-check-implementation-readiness`; chỉ khi status READY mới chạy `bmad-sprint-planning`.

### Final Note

Assessment xác định **7 findings** trong **3 categories**:

- 3 HIGH blockers: UX action conflict, FR-6 partial traceability, operator scope.
- 3 MAJOR improvements: release-gate classification, oversized stories, UX validation-state conflict.
- 1 MINOR traceability/tooling concern: FR range notation.

Không có missing FR, duplicate planning document, technical epic hoặc runtime forward dependency. Các corrections chủ yếu là contract alignment; không cần đổi kiến trúc lõi.

**Assessor:** BMad Implementation Readiness workflow
**Completed:** 2026-07-19
