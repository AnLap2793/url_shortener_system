---
title: Sprint Change Proposal — Resolve Implementation Readiness Blockers
project: url_shortener_system
date: 2026-07-19
status: approved-and-applied
approved: 2026-07-19
mode: incremental
changeScope: moderate
trigger:
  - implementation-readiness-report-2026-07-19-with-context.md
approvedEdits:
  - restore-view-analytics-action
  - clarify-fr6-partial-completion
  - constrain-operator-control-to-operations
  - convert-story-4-9-to-epic-dod
  - unify-invalid-url-submit-behavior
  - add-sprint-planning-sizing-gate
---

# Sprint Change Proposal — Resolve Implementation Readiness Blockers

## 1. Issue Summary

Implementation Readiness assessment kết luận **NEEDS WORK** dù PRD, UX, Architecture và Epics có FR coverage 100%. Vấn đề không đến từ code hoặc technical limitation; đây là các planning-contract inconsistencies được phát hiện trước Phase 4:

1. UX spine yêu cầu create-success action **“View analytics”**, nhưng Stories 2.1/2.5 dùng **“View link details”**.
2. FR-6 yêu cầu total click trên Links, nhưng Story 2.4 claim toàn bộ FR-6 trong khi defer total click sang Story 4.1.
3. Story 2.9 đưa authenticated operator/permission/endpoint vào MVP dù PRD không có admin UI/complex RBAC và UX không có operator surface.
4. Story 4.9 là release evidence gate nhưng đang được mô hình hóa như normal implementation story.
5. `EXPERIENCE.md` có hai rules trái nhau cho invalid URL submit.
6. Stories 3.2, 3.4, 4.3 và 4.5 có sizing risk cho một dev-agent context.

### Evidence

- `EXPERIENCE.md:111,145`: explicit “View analytics” sau create.
- `epics.md:693,967`: “View link details”.
- `epics.md:851–863`: Story 2.4 claim FR-6 nhưng defer total click.
- `epics.md:1208–1249`: operator actor/permission/endpoint.
- `epics.md:2288–2319`: Story 4.9 chứa release/traceability gate.
- `EXPERIENCE.md:66,88`: submit operable và submit disabled cùng tồn tại.
- `implementation-readiness-report-2026-07-19-with-context.md`: 3 HIGH blockers, 3 major improvements, 1 minor concern.

## 2. Impact Analysis

### Epic Impact

| Epic | Impact | Required change |
|---|---|---|
| Epic 1 | None | Không đổi |
| Epic 2 | Moderate | Sửa Stories 2.1, 2.4, 2.5, 2.9 |
| Epic 3 | Low | Không đổi scope; thêm sizing gate cho 3.2/3.4 tại Sprint Planning |
| Epic 4 | Moderate | Sửa Story 4.1; chuyển Story 4.9 thành Epic DoD; sizing gate cho 4.3/4.5 |

Không thêm/xóa/resequence epic. Dependency vẫn là `1 → 2 → 3 → 4`.

### Story Impact

- **2.1:** Khôi phục “View analytics”; analytics shell/empty state không phụ thuộc Epic 4 data implementation.
- **2.4:** Đánh dấu FR-6 partial.
- **2.5:** Khôi phục explicit “View analytics” navigation tới analytics section.
- **2.9:** Giới hạn thành operational config/CLI/runbook control; không admin UI/RBAC/public operator product route.
- **4.1:** Thêm FR-6 completion cho list total click.
- **4.9:** Bỏ khỏi normal story cycle, chuyển thành Epic 4 Release Readiness Checklist/Definition of Done.
- **3.2, 3.4, 4.3, 4.5:** Không tách ngay; Sprint Planning bắt buộc estimate và tách vertical slices nếu vượt một dev-agent context.

Sau thay đổi, backlog có **34 implementation stories + 1 Epic 4 Release Readiness Checklist**.

### Artifact Conflicts

| Artifact | Impact |
|---|---|
| PRD | Không đổi; MVP và FRs giữ nguyên |
| Architecture | Không đổi AD/stack/data model; operator control được thu hẹp để khớp AD-10 |
| EXPERIENCE.md | Sửa một invalid URL state; giữ “View analytics” authority |
| DESIGN.md | Không đổi |
| epics.md | Áp dụng 6 approved edit proposals |
| project-context.md | Không đổi; rules hiện tại đã phù hợp |
| readiness report | Chạy lại sau corrections |
| sprint-status.yaml | N/A; Sprint Planning chưa chạy |

### Technical Impact

- Không có rollback hoặc code migration vì implementation chưa bắt đầu.
- Không thay stack, schema, API architecture hoặc deployment topology.
- Không thêm product actor hoặc RBAC subsystem.
- Analytics shell trong Epic 2 chỉ là navigation/empty state; total/query implementation vẫn ở Epic 4.

## 3. Recommended Approach

### Selected Path: Direct Adjustment

Sửa trực tiếp `EXPERIENCE.md` và `epics.md`, sau đó chạy Implementation Readiness lại.

- **Effort:** Low.
- **Risk:** Low.
- **Scope:** Moderate change management vì có backlog classification và cross-artifact alignment.
- **MVP impact:** Không đổi scope hoặc goals.
- **Timeline impact:** Không có replan kiến trúc; chỉ chặn Sprint Planning cho tới khi readiness đạt READY.

### Alternatives Rejected

- **Rollback:** Không áp dụng; chưa có implementation hoặc sprint cần revert.
- **MVP reduction/redefinition:** Không cần; vấn đề là contract wording/classification, không phải feasibility.
- **New epic/operator product role:** Không cần và vi phạm YAGNI cho MVP.

## 4. Detailed Change Proposals

### 4.1 Stories 2.1 và 2.5 — Restore “View analytics”

**Story 2.1 — OLD**

```markdown
**Then** success state hiển thị full Short URL và Destination URL
**And** cung cấp “Copy link” và “View link details”
```

**Story 2.1 — NEW**

```markdown
**Then** success state hiển thị full Short URL và Destination URL
**And** cung cấp “Copy link” và “View analytics”
**And** “View analytics” mở Link detail analytics section bằng explicit navigation
**And** khi analytics data chưa được triển khai hoặc link chưa có click, section hiển thị empty analytics state
**And** Epic 2 không phụ thuộc aggregate/query implementation của Epic 4.
```

**Story 2.5 — OLD**

```markdown
**When** marketer chọn “View link details” từ success state
**Then** Link detail mở bằng explicit navigation
```

**Story 2.5 — NEW**

```markdown
**When** marketer chọn “View analytics” từ success state
**Then** Link detail mở tại analytics section bằng explicit navigation
**And** empty analytics state không yêu cầu Epic 4 data implementation
```

**Rationale:** Khớp binding UX spine mà không tạo runtime forward dependency.

### 4.2 Stories 2.4 và 4.1 — Clarify FR-6 Traceability

**Story 2.4 — OLD**

```markdown
**Requirements:** FR-6
```

**Story 2.4 — NEW**

```markdown
**Requirements:** FR-6 (partial — list metadata, ownership and search)
```

Giữ AC path/destination/date; nêu rõ FR-6 total click được hoàn tất bởi Story 4.1.

**Story 4.1 — OLD**

```markdown
**Requirements:** FR-13
```

**Story 4.1 — NEW**

```markdown
**Requirements:** FR-6 (completion — list total click), FR-13
```

**Rationale:** Traceability phản ánh đúng vertical delivery; không đổi dependency hoặc UX.

### 4.3 Story 2.9 — Operational Control Only

**OLD scope**

- Authenticated operator identity.
- `link:disable` permission.
- Operator endpoint.
- Nguy cơ tạo hidden admin actor/RBAC contract.

**NEW scope**

```markdown
### Story 2.9: Vô hiệu hóa malicious link qua operational control

**Scope:** Config/CLI/runbook-only operational control. Không có admin UI, product operator role, RBAC subsystem hoặc public operator route trong MVP.

- Chỉ deployment identity/authorized operations credential được thực thi command.
- Credential source và invocation procedure được ghi trong protected runbook; không lưu secret trong repo.
- Command nhận link ID hoặc denylist policy match, reason code, expected version và idempotency key.
- Disable atomically chuyển link inactive và registry sang permanent Tombstone.
- Owner thấy generic disabled safety state, không có reactivate action.
- Audit event lưu operational principal ID, link ID, reason, policy version, timestamp, correlation ID; không raw IP/token/full destination query.
- Nếu cần operator UI/RBAC, phải mở architecture/PRD/UX change proposal mới trước implementation.
```

**Rationale:** Giữ architecture denylist invariant nhưng không mở rộng MVP actor model.

### 4.4 Story 4.9 — Convert to Epic Definition of Done

**OLD**

```markdown
### Story 4.9: Release evidence và system-design demo
**Requirements:** FR-1–FR-16
Là một builder, ...
```

**NEW**

```markdown
### Epic 4 Release Readiness Checklist

Checklist này không phải implementation story, không có story estimate/status và chạy sau Stories 4.1–4.8.

- Unit, integration, Playwright E2E, accessibility, visual regression, performance và reconciliation checks pass.
- UI component inventory tuân DESIGN/EXPERIENCE contracts.
- SM-9 demo giải thích redirect, durable capture, fencing, idempotency, aggregation, retention, ownership, CSRF và failure isolation.
- Benchmark, security, accessibility, restore-drill và usability evidence được liên kết.
- FR-1–FR-16, NFR-1–NFR-16 và UX-DR1–UX-DR24 có passing evidence.
- Không có secret, raw IP hoặc sensitive URL trong artifacts.
- Unresolved phase-blocker làm Epic DoD thất bại.
```

**Rationale:** Release gate không giả dạng user story; evidence requirements vẫn giữ nguyên.

### 4.5 EXPERIENCE.md — Invalid URL State

**OLD**

```markdown
| Invalid URL | Inline error; submit disabled until corrected; preserve field value. |
```

**NEW**

```markdown
| Invalid URL | Inline error; submit remains operable so submit validation can reveal all errors; request is blocked until corrected; preserve field value. |
```

**Rationale:** Khớp Component Pattern, focused error summary và accessible error discovery.

### 4.6 Sprint Planning — Story Sizing Gate

Thêm planning rule:

```markdown
Before scheduling Stories 3.2, 3.4, 4.3 or 4.5, estimate implementation breadth against one dev-agent context. If a story combines more than one independently testable vertical slice or cannot complete within one story cycle, split it while preserving backward-only dependencies and original acceptance coverage.
```

**Rationale:** Không phình backlog trước estimate nhưng chặn oversized execution.

## 5. Implementation Handoff

### Scope Classification

**Moderate** — backlog/artifact alignment cần Product Owner/Developer coordination; không cần PM/Architect replan.

### Responsibilities

| Recipient | Responsibility |
|---|---|
| Product Owner / Correct Course executor | Áp dụng approved edits vào `EXPERIENCE.md` và `epics.md` |
| Developer/Planner | Giữ sizing gate khi tạo Sprint Plan; không triển khai Story 4.9 như normal story |
| Readiness workflow | Rerun và xác nhận READY |
| Architect | Không cần hành động; chỉ tham gia nếu operator UI/RBAC hoặc invariant mới được đề xuất |

### Success Criteria

- “View analytics” khớp UX và stories, không runtime forward dependency.
- FR-6 partial/completion traceability rõ.
- Story 2.9 không thêm product operator role/UI/RBAC.
- Story 4.9 trở thành Epic DoD checklist.
- Invalid URL behavior chỉ còn một rule.
- Sizing gate hiện diện cho 3.2, 3.4, 4.3, 4.5.
- Implementation Readiness rerun đạt **READY**.

## 6. Checklist Status

### Trigger and Context

- [x] 1.1 Trigger identified.
- [x] 1.2 Core problem categorized.
- [x] 1.3 Evidence documented.

### Epic Impact

- [x] 2.1 Current epics remain viable.
- [x] 2.2 Existing epic/story edits identified.
- [x] 2.3 Future epics reviewed.
- [x] 2.4 No new/obsolete epic.
- [x] 2.5 Epic order unchanged.

### Artifact Impact

- [x] 3.1 PRD reviewed; no change.
- [x] 3.2 Architecture reviewed; no AD change.
- [x] 3.3 UX state correction applied; existing “View analytics” remains authority.
- [x] 3.4 Approved Epic corrections applied; readiness rerun remains required.

### Path Forward

- [x] 4.1 Direct Adjustment viable — low effort/low risk.
- [N/A] 4.2 Rollback unnecessary.
- [N/A] 4.3 MVP review unnecessary.
- [x] 4.4 Direct Adjustment selected.

### Proposal and Handoff

- [x] 5.1 Issue summary complete.
- [x] 5.2 Epic/artifact impact complete.
- [x] 5.3 Recommended path documented.
- [x] 5.4 MVP unchanged; action plan defined.
- [x] 5.5 Moderate handoff defined.
- [x] 6.1 Checklist reviewed.
- [x] 6.2 Proposal drafted.
- [x] 6.3 User approved complete proposal on 2026-07-19.
- [N/A] 6.4 No `sprint-status.yaml`; Sprint Planning not started.
- [x] 6.5 Handoff: rerun Implementation Readiness, then Sprint Planning only if READY.

## 7. Applied Changes and Handoff Log

- Applied to `ux-designs/ux-url_shortener_system-2026-07-19/EXPERIENCE.md`: unified invalid URL submit behavior.
- Applied to `epics.md`: restored “View analytics”, clarified FR-6 partial/completion, constrained Story 2.9 to config/CLI/runbook-only operations, converted Story 4.9 to Epic 4 DoD checklist, added Sprint Planning sizing gate.
- No PRD, Architecture, DESIGN, code, deployment or sprint-status changes.
- Change scope: **Moderate**.
- Routed to: Implementation Readiness workflow for validation; Product Owner/Developer for subsequent Sprint Planning.
- Success condition: latest readiness assessment returns **READY**.
