---
title: Implementation Readiness Assessment Report — Rerun
project: url_shortener_system
date: 2026-07-19
status: in-progress
stepsCompleted:
  - step-01-document-discovery
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

# Implementation Readiness Assessment Report — Rerun

**Date:** 2026-07-19
**Project:** url_shortener_system

## 1. Document Inventory

- PRD: `prds/prd-url_shortener_system-2026-07-19/prd.md` — 21,948 bytes.
- Architecture: `architecture/architecture-url_shortener_system-2026-07-19/ARCHITECTURE-SPINE.md` — 21,584 bytes.
- Epics: `epics.md` — 114,258 bytes.
- UX: `ux-designs/ux-url_shortener_system-2026-07-19/DESIGN.md` — 6,124 bytes.
- UX: `ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md` — 14,203 bytes.
- Architecture companion: `C4-DIAGRAMS.md`.
- Không có whole/sharded duplicate, missing core document hoặc `project-context.md`.

## 2. PRD Analysis

### Functional Requirements

- **FR-1:** Marketer tạo tài khoản và đăng nhập bằng email/password; email được xác minh trước activation; credential errors không account enumeration.
- **FR-2:** Marketer đăng nhập bằng Google OAuth; collision không tạo account trùng hoặc auto-merge; linking chỉ sau email/password sign-in và fresh re-authentication.
- **FR-3:** Authenticated session, account-scoped ownership, logout/session expiry và password-reset out-of-scope disclosure.
- **FR-4:** Tạo Short Link từ Destination URL `http`/`https`; Alias trống thì sinh Code; link mới xuất hiện trong list.
- **FR-5:** Alias global, lowercase, 3–64 ký tự, chỉ `a-z`, `0-9`, `-`, không hyphen đầu/cuối và không trùng Code/Reserved Path/Tombstone.
- **FR-6:** Owned link list hiển thị short path, destination URL, ngày tạo và total click.
- **FR-7:** Sửa Destination URL của owned link; giữ short path và historical analytics; URL mới phải qua validation.
- **FR-8:** Xóa owned link; ẩn khỏi dashboard, path trả 404, giữ permanent Tombstone, retained aggregate ẩn và raw log tối đa 30 ngày.
- **FR-9:** Account-scoped create-link rate limit; vượt ngưỡng trả 429, không mutation và thông báo retry.
- **FR-10:** Public `/{Code}`/`/{Alias}` redirect tới destination hiện tại; missing path không external redirect; không yêu cầu auth.
- **FR-11:** Mỗi valid redirect request tạo một Click Event; bot/preview không event; retry idempotent; UTC timestamp, event-time UTM snapshot, dimensions và `unknown` fallback.
- **FR-12:** UTM builder cho source/medium/campaign, preview, non-blocking casing/space warning, duplicate-key replacement và preservation của unrelated query/fragment.
- **FR-13:** Total click cho từng link trên list và detail.
- **FR-14:** Daily UTC analytics, default 30 ngày và zero-filled dates.
- **FR-15:** AND breakdown/filter theo referrer, country, city, device, browser và ba UTM dimensions; historical snapshot, estimated location, `unknown`, no raw IP.
- **FR-16:** Request-based refresh giữ context; click xuất hiện ≤60 giây trong load envelope; Last updated và freshness warning.

**Tổng FR:** 16.

### Non-Functional Requirements

- **NFR-1:** Redirect p95 ≤200 ms tại 100 rps/20 connections trong 10 phút; aggregation không chặn redirect.
- **NFR-2:** Dashboard p95 ≤2 giây với 100.000 events trong 30 ngày và 20 concurrent requests sau warm-up.
- **NFR-3:** Valid click xuất hiện trong analytics ≤60 giây trong declared load envelope.
- **NFR-4:** Authenticated session; production cookie `HttpOnly`, `Secure`, `SameSite` phù hợp.
- **NFR-5:** Secure password hashing; không plaintext/reversible encryption.
- **NFR-6:** Login rate limit và generic non-enumerating errors.
- **NFR-7:** Mọi mutation có CSRF protection hoặc framework-equivalent.
- **NFR-8:** Destination URL chỉ `http`/`https`.
- **NFR-9:** Global namespace chặn Reserved Path, collision và invalid characters.
- **NFR-10:** OAuth `state` và OIDC `nonce`.
- **NFR-11:** Aggregate-first analytics; không cross-site profiling.
- **NFR-12:** Raw logs tối đa 30 ngày; retained aggregates giữ không thời hạn trong MVP; deleted-link aggregates ẩn.
- **NFR-13:** Dashboard không hiển thị raw IP.
- **NFR-14:** City-level location được mô tả là estimated.
- **NFR-15:** Local enrichment failure không làm redirect fail.
- **NFR-16:** Deleted path trả 404, giữ Tombstone, không redirect destination cũ.

**Tổng NFR:** 16.

### Additional Requirements

- Responsive web dashboard; email/password + Google; link CRUD; UTM; public redirect; durable analytics; aggregate-first privacy.
- Global Short Path Namespace và precedence của existing short paths trước routes thêm sau.
- Success gates gồm redirect correctness, 100% analytics reconciliation trong 60 giây, NFR benchmarks, security evidence và seeded usability task.
- Out of scope: custom domain, team workspace/RBAC phức tạp, QR, bulk, public API, A/B routing, protected/expiring links, integrations, billing, realtime analytics và password reset.
- PRD nói deep phishing/malware detection ngoài MVP; baseline abuse controls là validation và create-link rate limiting.
- Không có open question hoặc assumption chặn phase tiếp theo.

### PRD Completeness Assessment

PRD đầy đủ, requirements có ID ổn định và testable consequences. Sequencing guidance trong PRD khác epic order nhưng không phải binding architecture contract; cần đánh giá dependency thực trong Epic Quality Review.
