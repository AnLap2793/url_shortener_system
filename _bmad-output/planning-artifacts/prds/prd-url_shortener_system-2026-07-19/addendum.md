# Addendum: URL Shortener System PRD

## Source inputs reconciled

- Product brief: `_bmad-output/planning-artifacts/briefs/brief-url_shortener_system-2026-07-19/brief.md`
- Brief addendum: `_bmad-output/planning-artifacts/briefs/brief-url_shortener_system-2026-07-19/addendum.md`

## Ghi chú nghiên cứu cho architecture

Tất cả hành vi ràng buộc nằm trong `prd.md`; phần này chỉ lưu bằng chứng nghiên cứu.

- Các sản phẩm tương tự thường có alias tùy chỉnh, campaign tagging, link management và analytics.
- Google Analytics khuyến nghị `utm_source`, `utm_medium`, `utm_campaign`; UTM values phân biệt hoa/thường nên sản phẩm cần cảnh báo inconsistency.
- Google OAuth đủ cho MVP; chưa cần thêm OAuth provider.
- Redirect path không được chờ analytics enrichment; architecture phải giữ failure isolation đã khóa trong PRD.
- City-level location chỉ là ước lượng và có rủi ro privacy; ưu tiên derived fields, không hiển thị raw IP.

## Sources consulted

- https://bitly.com/pages/products/url-shortener
- https://bitly.com/pages/products/link-management
- https://www.rebrandly.com/features
- https://dub.co/help/article/utm-builder
- https://support.google.com/analytics/answer/10917952
- https://developers.google.com/identity/protocols/oauth2
- https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html
