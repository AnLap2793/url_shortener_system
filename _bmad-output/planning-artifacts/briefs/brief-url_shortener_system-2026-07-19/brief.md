---
title: Product Brief: URL Shortener System
status: ready-for-prd
created: 2026-07-19
updated: 2026-07-19
---

# Product Brief: URL Shortener System

## Tóm tắt

URL Shortener System là một ứng dụng web dành cho đội marketing tạo, quản lý và đo hiệu quả các link rút gọn dùng trong mạng xã hội, email và quảng cáo. Sản phẩm không chỉ biến URL dài thành URL ngắn; giá trị chính là giúp marketer biết link nào hoạt động tốt, click đến từ đâu, diễn ra khi nào, và người dùng truy cập bằng thiết bị/trình duyệt nào.

Mục tiêu của MVP là đủ thật để đội marketing có thể dùng trong công việc, đồng thời đủ rõ để phục vụ học nghiệp vụ, system design và portfolio. Vì vậy sản phẩm cần đăng nhập, dashboard, alias tùy chỉnh, UTM builder và analytics thực tế. Bản đầu không mở rộng sang tính năng cấp doanh nghiệp.

## Vấn đề

Đội marketing thường chia sẻ nhiều link qua mạng xã hội, email và quảng cáo. URL gốc dài, khó nhớ, khó đặt vào nội dung chiến dịch, và khó theo dõi hiệu quả nếu không có lớp tracking riêng. Khi chạy nhiều chiến dịch cùng lúc, team cần trả lời nhanh:

- Link nào được click nhiều nhất?
- Click tăng vào ngày nào?
- Người dùng đến từ nguồn giới thiệu nào?
- Người dùng ở quốc gia/thành phố nào?
- Người dùng dùng thiết bị/trình duyệt gì?
- Link chiến dịch có dễ đọc và đúng ngữ cảnh không?

Nếu không có hệ thống riêng, team phụ thuộc vào công cụ ngoài hoặc tracking rời rạc. Điều này làm giảm khả năng học từ chiến dịch và khó chứng minh hiệu quả.

## Giải pháp

Xây dựng ứng dụng web URL shortener có dashboard cho đội marketing:

- Người dùng đăng nhập bằng email/password hoặc OAuth.
- Tạo short link từ long URL.
- Cho phép alias tùy chỉnh, ví dụ `/summer-sale`.
- Tạo và giữ UTM parameters cho campaign tracking.
- Redirect người truy cập từ short link sang URL gốc.
- Ghi nhận analytics cho mỗi lượt click.
- Hiển thị dashboard thống kê theo tổng lượt click, ngày, referrer, quốc gia, thành phố, thiết bị và trình duyệt.

Trải nghiệm chính: marketer tạo link chiến dịch, cấu hình UTM, chia sẻ link qua mạng xã hội/email/quảng cáo, quay lại dashboard để xem hiệu quả và ra quyết định tối ưu nội dung hoặc kênh phân phối.

## Người dùng chính

Người dùng chính là đội marketing vận hành chiến dịch thật. Họ cần thao tác nhanh, link dễ đọc, dashboard dễ hiểu, và số liệu đủ tin để so sánh hiệu quả giữa các kênh.

Đối tượng phụ là người xem portfolio hoặc người học system design. Với nhóm này, sản phẩm cần thể hiện rõ nghiệp vụ, luồng redirect, sự kiện tracking, tổng hợp dữ liệu, authentication và dashboard analytics.

## Phạm vi MVP

### Trong phạm vi

- Authentication bằng email/password và OAuth.
- Tạo short link từ long URL.
- Alias tùy chỉnh có kiểm tra trùng, reserved words và validation.
- UTM builder cho campaign links.
- Danh sách link đã tạo.
- Chỉnh sửa/xóa link.
- Redirect từ short link sang URL gốc.
- Validate URL đích chỉ nhận `http`/`https`.
- Click tracking.
- Dashboard analytics:
  - tổng lượt click
  - lượt click theo ngày
  - referrer
  - quốc gia
  - thành phố
  - thiết bị
  - trình duyệt
- Aggregate-first analytics; không lập hồ sơ người dùng trên nhiều website.
- Raw click log retention ngắn hoặc aggregate sớm.

### Ngoài phạm vi bản đầu

- Custom domain.
- Team workspace và phân quyền nhiều vai trò.
- QR code.
- Bulk link creation.
- Public API.
- A/B routing.
- Password-protected links.
- Link expiration.
- Webhook/integration với công cụ marketing.
- Billing/subscription.

## Quyết định bàn giao cho PRD

- Auth: email/password và OAuth đều nằm trong MVP.
- Location analytics: gồm quốc gia và thành phố.
- UTM builder: nằm trong MVP, không chỉ preserve UTM từ URL gốc.
- Custom domain: loại khỏi MVP.
- Privacy: ưu tiên aggregate analytics, raw click log retention ngắn hoặc aggregate sớm.

## MVP complexity watchlist

Các mục sau nằm sát mép MVP và cần sequencing rõ trong PRD:

- OAuth: nên bắt đầu với một provider phổ biến trước.
- City-level location: cần chấp nhận độ chính xác tương đối và privacy cost.
- UTM builder: giữ form đơn giản, chỉ các field campaign cơ bản.
- Analytics dashboard: ưu tiên câu hỏi marketing cốt lõi, tránh biểu đồ phụ.

## Thứ tự phụ thuộc cho PRD

1. Link model và redirect flow.
2. Authentication và link ownership.
3. Click event capture.
4. Aggregation và retention policy.
5. Dashboard analytics.
6. UTM builder.
7. OAuth provider.

## Khác biệt

Khác biệt của sản phẩm không nằm ở “rút gọn URL”, vì đây là tính năng phổ biến. Điểm đáng giá là bản MVP tập trung đúng nghiệp vụ marketing: alias tùy chỉnh cho chiến dịch, UTM builder, analytics đọc được ngay, và thiết kế đủ thật để dùng nội bộ thay vì chỉ là demo kỹ thuật.

Với mục tiêu học system design, sản phẩm cũng là bài toán tốt: redirect path cần nhanh, write path cần ghi event click, dashboard cần aggregate data, và hệ thống phải xử lý trade-off giữa tracking chi tiết và quyền riêng tư.

## Tiêu chí thành công

### Link creation và redirect

- Marketing team tạo được short link từ long URL.
- Mỗi short link redirect đúng sang URL gốc.
- Alias tùy chỉnh hoạt động và xử lý được alias trùng/reserved.

### Authenticated link management

- Người dùng đăng nhập được bằng email/password hoặc OAuth.
- Người dùng xem, chỉnh sửa và xóa link của mình.

### Campaign attribution

- UTM builder giúp tạo campaign link nhất quán.
- Link giữ đúng UTM parameters khi redirect.

### Analytics visibility

- Mỗi click được ghi nhận và xuất hiện trong analytics.
- Dashboard trả lời được: link nào hiệu quả, click đến từ đâu, xảy ra khi nào, dùng thiết bị/trình duyệt gì.

### Privacy và retention

- Analytics ưu tiên dữ liệu aggregate.
- Raw click log có retention ngắn hoặc được aggregate sớm.
- Không lập hồ sơ người dùng trên nhiều website.

## Rủi ro và lưu ý

- Location từ IP chỉ tương đối; không nên hứa độ chính xác cao.
- Referrer có thể thiếu do browser, app, email client hoặc privacy policy chặn.
- Device/browser detection phụ thuộc user-agent và có thể không hoàn hảo.
- Analytics có thể liên quan dữ liệu cá nhân nếu lưu IP hoặc user-agent thô; MVP cần giới hạn retention hoặc aggregate sớm.
- Alias tùy chỉnh cần reserved words và validation để tránh slug gây lỗi hoặc lạm dụng.
- OAuth làm tăng scope so với email/password; nên dùng provider phổ biến trước, không làm nhiều provider khi chưa cần.

## Tầm nhìn

Nếu MVP thành công, sản phẩm có thể phát triển thành campaign link management tool cho đội marketing: workspace nhiều thành viên, custom domain, QR code, bulk creation, link expiration, API và integrations. Nhưng bản đầu không cần làm hết. Bản đầu cần làm một việc tốt: tạo link chiến dịch và cho marketer thấy hiệu quả thật.
