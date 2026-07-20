# Addendum: URL Shortener System

## Ghi chú nghiên cứu ban đầu

- Marketing URL shortener MVP nên có branded/custom links, dashboard analytics và link management, không chỉ redirect.
- Analytics dimensions như total clicks, time/day, geography/location, device, browser và referrer là kỳ vọng phổ biến ở sản phẩm loại này.
- Authentication là cần thiết cho dashboard thật; roles/workspace có thể để sau MVP.
- Privacy risk: IP, location, user-agent, browser/device và referrer có thể liên quan personal data. MVP nên ưu tiên aggregate analytics, raw log retention ngắn, không cross-site profiling.
- Referrer/location/device/browser có thể không chính xác hoặc thiếu do browser privacy, app/email client, HTTPS policy và user-agent limitations.

## Quyết định cuối đã thay đổi so với nghiên cứu ban đầu

- UTM builder nằm trong MVP. Ghi chú “preserve UTM trước, builder để sau” đã bị supersede bởi quyết định người dùng.
- Location analytics gồm cả country và city. Cần ghi rõ độ chính xác tương đối trong PRD.
- Custom domain không nằm trong MVP.

## Nguồn tham khảo

- https://www.rebrandly.com/
- https://short.io/
- https://support.google.com/analytics/answer/10917952
- https://developers.cloudflare.com/rules/url-forwarding/
- https://gdpr.eu/cookies/
