# Accessibility & Inclusive Interaction Review

**Phạm vi:** `DESIGN.md`, `EXPERIENCE.md`; đối chiếu mục tiêu WCAG 2.2 AA. Tài liệu có nền tảng tốt: semantic structure, keyboard intent, table fallback, non-color status, live feedback, focus return cho delete dialog, 44px touch target và reduced-motion intent. Tuy nhiên chưa đủ để tuyên bố conformant; nên ghi “target”, chỉ xác nhận AA sau kiểm thử implementation.

## Critical

- Không phát hiện blocker Critical ở mức đặc tả.

## High

1. **Contrast token không đạt AA cho cách dùng đã nêu.** `{colors.primary}` trên page/surface chỉ khoảng **4.19:1/4.30:1**, nên link và normal text thất bại 4.5:1. Chữ trắng trên primary button khoảng **4.42:1**, cũng thất bại. `{colors.ink-muted}` khoảng **3.41:1/3.50:1** không phù hợp normal-size axis/metadata. Warning khoảng **3.89:1/4.00:1** nếu dùng làm text. Đổi token hoặc giới hạn rõ theo font size/role; kiểm thử mọi state hover/focus/disabled (1.4.3, 1.4.11).
2. **Reflow claim sai ngưỡng.** “Preserve zoom/reflow at 200%” chưa đáp ứng Reflow: nội dung phải hoạt động ở chiều rộng tương đương **320 CSS px (thường 400% zoom)**, không cuộn hai chiều ngoại trừ data table hợp lệ. Test 320px, 400%, 200% text spacing; không để sticky action che nội dung (1.4.10, 1.4.12).
3. **Authentication chưa bao phủ Accessible Authentication.** Bổ sung password-manager/autofill (`autocomplete`), cho phép paste, không yêu cầu ghi nhớ/transcribe hoặc cognitive test; password reveal có tên/state; lỗi không enumerate account; re-auth/session expiry phải cảnh báo và giữ dữ liệu an toàn (3.3.7, 3.3.8).

## Medium

1. **Keyboard model chưa đủ cụ thể.** Không biến `<tr>` thành control; đặt link/button thật trong cell, hỗ trợ `Enter` và `Space` theo native semantics. Chart marks 24px mâu thuẫn floor 44px cho pointer target; nếu chart tương tác, định nghĩa tab stop, arrow-key navigation và accessible name/value, hoặc để chart non-interactive và table là đường truy cập chính (2.1.1, 2.5.8, 4.1.2).
2. **Focus/dialog/drawer/popover thiếu vòng đời hoàn chỉnh.** Quy định initial focus, focus containment, background `inert`, Escape, close button có accessible name, và trả focus về trigger cho mọi overlay—not chỉ delete dialog. Không để overflow/sticky header che focused item; dùng `scroll-padding` khi cần (2.4.11, 2.4.12).
3. **Error handling chưa đầy đủ.** “Disable submit until corrected” có thể giấu cơ hội khám phá lỗi và xung đột validate-on-submit. Cho phép submit để kích hoạt validation; dùng `aria-invalid`, liên kết hint/error, error summary có focus/link đến field; không xóa input; thông báo retry time và network/server errors cạnh tác vụ. Live region nên quy định `polite`/`assertive`, `role`, `aria-atomic`, chống announcement lặp (3.3.1–3.3.4, 4.1.3).
4. **Chart/color alternative chưa đủ mạnh.** Nhiều series dưới 3:1 với surface; direct label/table không làm data marks tự phân biệt. Thêm pattern/shape/stroke/direct label, legend-programmatic association, text summary và table caption/headers/scope. Tooltip phải dismissible, hoverable, persistent và không chứa thông tin độc quyền (1.3.1, 1.4.1, 1.4.11, 1.4.13).

## Low

- Quy định landmarks/headings/skip link, page title và route-change focus announcement; `aria-busy` cho refresh/skeleton; drawer trigger `aria-expanded`/`aria-controls`.
- Reduced motion cần nêu hiệu ứng bị tắt: smooth scroll, skeleton shimmer, spinner/transition; giữ feedback tĩnh tương đương. Không autoplay hoặc parallax thiết yếu.
- Chuyển nguyên tắc từ desktop-first sang content-first/mobile-first validation; xác nhận 44×44px cả menu actions, copy và auth controls.

**Status:** DONE_WITH_CONCERNS
**Summary:** Audit hoàn tất; nền tảng tốt nhưng contrast, reflow và accessible authentication phải sửa trước khi claim WCAG 2.2 AA.
**Concerns/Blockers:** Chưa có implementation để kiểm thử tự động, keyboard thực tế, screen reader và zoom/reflow.
