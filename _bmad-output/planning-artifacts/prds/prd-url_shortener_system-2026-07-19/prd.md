---
title: PRD: URL Shortener System
status: final
created: 2026-07-19
updated: 2026-07-19
---

# PRD: URL Shortener System

## 0. Mục đích tài liệu

PRD này dùng cho UX, architecture, epics/stories và implementation của URL Shortener System. Tài liệu chuyển product brief thành yêu cầu sản phẩm có ID ổn định, glossary chung, user journey, functional requirements, non-functional requirements, scope và success metrics. Các quyết định kỹ thuật chi tiết thuộc architecture; PRD chỉ khóa hành vi sản phẩm.

Nguồn đầu vào:

- `_bmad-output/planning-artifacts/briefs/brief-url_shortener_system-2026-07-19/brief.md`
- `_bmad-output/planning-artifacts/briefs/brief-url_shortener_system-2026-07-19/addendum.md`

## 1. Vision

URL Shortener System là ứng dụng web giúp đội marketing tạo link rút gọn cho chiến dịch, chia sẻ qua mạng xã hội/email/quảng cáo, và xem analytics để hiểu hiệu quả phân phối. Sản phẩm ưu tiên học system design nhưng vẫn phải đủ thật để marketing team dùng được trong công việc.

Luồng giá trị cốt lõi: marketer đăng nhập, tạo campaign link có alias dễ đọc và UTM parameters, chia sẻ link, hệ thống redirect người truy cập tới URL gốc, ghi nhận click event, rồi hiển thị analytics theo tổng click, ngày, referrer, quốc gia, thành phố, thiết bị và trình duyệt.

MVP không cạnh tranh bằng nhiều tính năng. MVP thắng bằng việc làm đúng workflow nhỏ: tạo link chiến dịch, redirect đúng, đo số liệu đủ tin, và giữ privacy boundary rõ.

## 2. Target User

### 2.1 Jobs To Be Done

- Khi chuẩn bị chiến dịch, marketer muốn tạo link ngắn dễ đọc để dùng trên mạng xã hội, email và quảng cáo.
- Khi cần phân biệt kênh/campaign, marketer muốn tạo UTM parameters nhất quán mà không tự ghép query string thủ công.
- Khi chiến dịch đang chạy, marketer muốn xem link nào tạo click, click đến từ đâu, xảy ra ngày nào, dùng thiết bị/trình duyệt gì.
- Khi phát hiện link sai hoặc chiến dịch kết thúc, marketer muốn sửa hoặc xóa link mình quản lý.
- Khi học system design, builder muốn sản phẩm thể hiện rõ redirect path, event capture, aggregation, dashboard và authentication.

### 2.2 Non-Users v1

- Enterprise marketing operations cần workspace nhiều team, phân quyền phức tạp, audit nâng cao.
- Người dùng cần custom domain, QR code, bulk link creation hoặc public API ngay.
- Người dùng cần realtime dashboard; MVP chỉ refresh theo request.

### 2.3 Key User Journeys

- **UJ-1. Linh tạo link chiến dịch Summer Sale và kiểm tra hiệu quả sau một ngày.**
  - **Persona + context:** Linh là marketer đại diện, chạy quảng cáo và email cho chiến dịch Summer Sale.
  - **Entry state:** Linh đã có tài khoản, mở dashboard trên web.
  - **Path:** Linh đăng nhập bằng Google và tạo hai **Short Link** cùng **Destination URL**: một link cho email với `utm_medium=email`, một link cho ads với `utm_medium=paid-social`; mỗi link có **Alias** riêng. Linh chia sẻ đúng link qua từng kênh. Ngày hôm sau, Linh mở dashboard và refresh analytics.
  - **Climax:** Dashboard hiển thị tổng click và breakdown theo ngày, `utm_medium`, referrer, quốc gia/thành phố, thiết bị và trình duyệt cho hai link.
  - **Resolution:** Linh so sánh hai link, thấy ads tạo nhiều click hơn email, nên tăng ngân sách ads và điều chỉnh nội dung email.
  - **Edge case:** Nếu alias `summer-sale` đã tồn tại, hệ thống yêu cầu Linh chọn alias khác trước khi tạo link.

- **UJ-2. Minh sửa link khi URL đích campaign bị sai.**
  - **Persona + context:** Minh là marketer đại diện, phát hiện link quảng cáo đang trỏ tới landing page cũ.
  - **Entry state:** Minh đã đăng nhập và sở hữu link cần sửa.
  - **Path:** Minh mở danh sách link, tìm link theo alias, chỉnh URL đích, lưu thay đổi, rồi kiểm tra redirect.
  - **Climax:** Short link cũ vẫn giữ nguyên nhưng redirect sang URL đích mới.
  - **Resolution:** Campaign không cần phát hành lại link.
  - **Edge case:** Nếu URL đích không phải `http`/`https`, hệ thống từ chối lưu.

## 3. Glossary

- **Short Link** — URL rút gọn public dạng `/{Code}` hoặc `/{Alias}` redirect tới **Destination URL**.
- **Destination URL** — URL gốc mà **Short Link** chuyển hướng tới; chỉ chấp nhận `http` hoặc `https`.
- **Code** — chuỗi lowercase do hệ thống sinh tự động cho **Short Link**, ví dụ `/abac123`.
- **Alias** — slug lowercase tùy chỉnh do marketer nhập, ví dụ `/summer-sale`.
- **Short Path Namespace** — namespace global dùng chung cho **Code** và **Alias**; mọi path phải duy nhất, gồm cả path đã tombstone.
- **Reserved Path** — path hệ thống không được dùng làm **Code** hoặc **Alias**; danh sách lấy từ routes hiện tại và reserved prefix được cấu hình, tối thiểu gồm `/login`, `/dashboard`, `/api`. **Short Path** đang tồn tại luôn được ưu tiên hơn route được thêm sau; route mới phải chọn path/prefix khác.
- **Tombstone** — bản ghi giữ **Code** hoặc **Alias** đã xóa để path đó không bao giờ được tái sử dụng.
- **UTM Parameters** — query parameters dùng cho campaign tracking, gồm `utm_source`, `utm_medium`, `utm_campaign` trong MVP.
- **Click Event** — một lượt truy cập vào **Short Link** được hệ thống ghi nhận để phục vụ analytics.
- **Analytics Dashboard** — màn hình hiển thị thống kê aggregate theo link.
- **Marketer** — người dùng đăng nhập để tạo, quản lý và xem analytics của **Short Link**.
- **OAuth** — đăng nhập qua Google trong MVP.

## 4. Features

### 4.1 Authentication và account access

**Description:** Marketer đăng nhập để quản lý link của mình. MVP hỗ trợ email/password và Google OAuth. Không có role hoặc admin UI trong MVP.

#### FR-1: Email/password sign up và sign in

Marketer có thể tạo tài khoản và đăng nhập bằng email/password.

**Consequences:**
- Hệ thống không cho truy cập dashboard khi chưa đăng nhập.
- Email phải hợp lệ, được xác minh trước khi tài khoản email/password hoạt động, và password phải đáp ứng password policy do security standard quy định.
- Đăng nhập sai credentials trả lỗi rõ ràng, không tiết lộ email có tồn tại hay không.

#### FR-2: Google OAuth sign in

Marketer có thể đăng nhập bằng Google OAuth.

**Consequences:**
- OAuth provider trong MVP là Google.
- Sau khi đăng nhập Google thành công và không có account collision, marketer vào được dashboard.
- Nếu Google trả về email đã thuộc account email/password nhưng chưa liên kết, hệ thống không tạo account mới và không đăng nhập; marketer phải đăng nhập bằng email/password rồi liên kết Google sau khi re-authenticate.
- Nếu OAuth thất bại hoặc bị hủy, marketer quay lại màn hình đăng nhập với thông báo lỗi.

#### FR-3: Session và account lifecycle

Marketer chỉ xem và quản lý **Short Link** thuộc tài khoản của mình và có thể kết thúc session.

**Consequences:**
- Người chưa đăng nhập không truy cập được dashboard.
- Marketer A không thấy hoặc chỉnh được link của Marketer B.
- Marketer có thể đăng xuất; session hết hạn buộc đăng nhập lại.
- Cùng email từ Google OAuth và email/password chỉ được liên kết sau khi email đã xác minh và marketer re-authenticate bằng phương thức đã liên kết; không tự động gộp account chỉ dựa trên email claim.
- Password reset nằm ngoài MVP; màn hình đăng nhập phải nêu rõ giới hạn này.

### 4.2 Link creation và management

**Description:** Marketer tạo **Short Link** từ **Destination URL**, chọn **Alias** nếu muốn, xem danh sách link, chỉnh sửa hoặc xóa link. Realizes UJ-1, UJ-2.

#### FR-4: Create short link

Marketer có thể tạo **Short Link** bằng cách nhập **Destination URL**.

**Consequences:**
- URL đích chỉ hợp lệ khi dùng `http` hoặc `https`.
- Nếu marketer không nhập **Alias**, hệ thống sinh **Code** tự động.
- Short link tạo xong xuất hiện trong danh sách link.

#### FR-5: Custom alias

Marketer có thể nhập **Alias** tùy chỉnh cho **Short Link**.

**Consequences:**
- Alias phải duy nhất trong **Short Path Namespace**, không phân biệt tài khoản.
- Alias không được trùng **Code**, **Reserved Path** hoặc **Tombstone**.
- Alias được normalize lowercase trước khi kiểm tra uniqueness.
- Alias dài 3–64 ký tự, chỉ gồm chữ thường `a-z`, chữ số `0-9` và dấu gạch nối `-`.
- Alias không được bắt đầu hoặc kết thúc bằng dấu gạch nối.
- Nếu alias không hợp lệ hoặc đã tồn tại, hệ thống không tạo link và hiển thị lỗi.

#### FR-6: Link list

Marketer có thể xem danh sách **Short Link** đã tạo.

**Consequences:**
- Mỗi item hiển thị short path, destination URL, ngày tạo và tổng click.
- Danh sách chỉ gồm link thuộc marketer đang đăng nhập.

#### FR-7: Edit destination URL

Marketer có thể sửa **Destination URL** của **Short Link** mình sở hữu.

**Consequences:**
- Short path giữ nguyên sau khi sửa destination.
- URL mới phải qua validation `http`/`https`.
- Analytics cũ vẫn gắn với cùng short link.

#### FR-8: Delete short link

Marketer có thể xóa **Short Link** mình sở hữu.

**Consequences:**
- Link đã xóa không còn xuất hiện trong dashboard.
- Truy cập short path đã xóa trả HTTP 404 và không redirect tới URL cũ.
- Hệ thống giữ **Tombstone**; **Code** hoặc **Alias** đã xóa không được tái sử dụng.
- Aggregate analytics của link đã xóa được giữ lại theo retention policy nhưng không còn hiển thị trong dashboard MVP; raw log vẫn tuân thủ giới hạn 30 ngày.

#### FR-9: Rate limit link creation

Hệ thống giới hạn tần suất tạo **Short Link** theo tài khoản để giảm spam và lạm dụng.

**Consequences:**
- Khi vượt ngưỡng, request tạo link bị từ chối bằng HTTP 429 và không tạo dữ liệu mới.
- Marketer nhận thông báo có thể thử lại sau.
- Ngưỡng cụ thể thuộc architecture/configuration, không làm thay đổi hành vi sản phẩm.

### 4.3 Redirect và click tracking

**Description:** Public visitor truy cập **Short Link**, hệ thống redirect tới **Destination URL** và ghi **Click Event** để phục vụ analytics.

#### FR-10: Public redirect

Visitor có thể mở **Short Link** dạng `/{Code}` hoặc `/{Alias}` và được redirect tới **Destination URL**.

**Consequences:**
- Short path hợp lệ redirect tới destination hiện tại.
- Short path không tồn tại không redirect tới trang ngoài.
- Redirect không yêu cầu visitor đăng nhập.

#### FR-11: Click event capture

Hệ thống ghi nhận **Click Event** khi visitor truy cập **Short Link**.

**Consequences:**
- Mỗi request redirect hợp lệ tạo một **Click Event**; không deduplicate visitor theo IP hoặc user-agent.
- Request từ bot/link preview đã nhận diện vẫn được redirect nhưng không tạo **Click Event** và không xuất hiện trong analytics marketer.
- Việc xử lý/retry event phải idempotent để cùng một request không bị ghi trùng.
- Click event gắn với đúng **Short Link**, có timestamp UTC và snapshot effective UTM values tại thời điểm redirect.
- Click event có các field phục vụ aggregate: referrer, country, city, device, browser khi suy luận được.
- Thiếu referrer/location/device/browser không làm redirect thất bại; giá trị thiếu được nhóm vào `unknown`.

### 4.4 UTM builder

**Description:** Marketer tạo campaign URL nhất quán bằng form UTM thay vì tự ghép query string. Realizes UJ-1.

#### FR-12: Build UTM parameters

Marketer có thể nhập các field UTM cơ bản cho **Destination URL**.

**Consequences:**
- MVP hỗ trợ `utm_source`, `utm_medium`, `utm_campaign`.
- Hệ thống tạo preview URL cuối cùng trước khi tạo short link.
- UTM values được giữ lại khi redirect.
- Hệ thống cảnh báo nhưng vẫn cho tiếp tục nếu UTM value có chữ hoa hoặc khoảng trắng; giá trị được trim khoảng trắng đầu/cuối, giữ nguyên casing và percent-encode khi tạo URL.
- Nếu **Destination URL** đã có cùng UTM key, giá trị trong UTM builder thay thế giá trị cũ; query parameters khác và fragment được giữ nguyên.

### 4.5 Analytics dashboard

**Description:** Marketer xem analytics aggregate cho từng **Short Link**. Dashboard refresh theo request, không realtime streaming.

#### FR-13: Link analytics summary

Marketer có thể xem tổng click của từng **Short Link**.

**Consequences:**
- Tổng click tăng sau khi short link được truy cập và event được xử lý.
- Tổng click hiển thị trên link list và link detail.

#### FR-14: Analytics by day

Marketer có thể xem lượt click theo ngày cho một **Short Link**.

**Consequences:**
- Dashboard nhóm click theo ngày theo UTC trong MVP.
- Date range mặc định là 30 ngày gần nhất.
- Ngày không có click trong date range phải hiển thị là 0.

#### FR-15: Analytics breakdowns

Marketer có thể xem breakdown và filter theo referrer, country, city, device, browser, `utm_source`, `utm_medium` và `utm_campaign`.

**Consequences:**
- Dashboard phân tích campaign và kênh bằng UTM snapshot lưu trên từng **Click Event** tại thời điểm redirect.
- Sửa **Destination URL** chỉ ảnh hưởng click tương lai; analytics lịch sử giữ nguyên UTM snapshot cũ.
- Mỗi filter thu hẹp tập event; nhiều filter kết hợp theo phép AND.
- Breakdown chỉ hiển thị dữ liệu suy luận được hoặc UTM snapshot hiện diện trên **Click Event**.
- Location được xem là estimated, không cam kết chính xác tuyệt đối.
- Dashboard phân biệt dữ liệu `unknown` khi referrer hoặc enrichment bị thiếu.
- Dashboard không hiển thị raw IP cho marketer.

#### FR-16: Refresh on request

Marketer có thể refresh dashboard để lấy analytics mới nhất hiện có.

**Consequences:**
- Không yêu cầu realtime update.
- Click hợp lệ phải xuất hiện trong analytics trong tối đa 60 giây ở tải MVP.
- Dashboard hiển thị thời điểm cập nhật gần nhất và cảnh báo dữ liệu có thể trễ tối đa 60 giây.
- Refresh không làm mất filter/context hiện tại.

## 5. Cross-Cutting NFRs

### Performance

- NFR-1: Redirect p95 không vượt 200 ms với 100 request/giây, 20 concurrent connections, chạy ổn định 10 phút; analytics enrichment không được chặn redirect.
- NFR-2: Dashboard analytics p95 không vượt 2 giây với 100.000 **Click Event** trong date range 30 ngày và 20 concurrent dashboard requests, đo sau một warm-up run.
- NFR-3: Click hợp lệ xuất hiện trong analytics trong tối đa 60 giây khi hệ thống chạy trong load envelope của NFR-1 và NFR-2.

### Security

- NFR-4: Dashboard và link management yêu cầu authenticated session; session cookie phải dùng `HttpOnly`, `Secure` trong production và `SameSite` phù hợp.
- NFR-5: Password phải được lưu bằng password-hashing algorithm phù hợp; không lưu plaintext hoặc reversible encryption.
- NFR-6: Login phải có rate limit và thông báo lỗi không tiết lộ tài khoản tồn tại.
- NFR-7: Mọi mutation yêu cầu CSRF protection hoặc cơ chế tương đương của framework.
- NFR-8: Destination URL chỉ nhận `http`/`https` để giảm rủi ro redirect nguy hiểm.
- NFR-9: **Short Path Namespace** phải chặn **Reserved Path**, collision và ký tự không hợp lệ.
- NFR-10: OAuth phải chống CSRF bằng `state` và kiểm tra `nonce` khi dùng OIDC; chi tiết kỹ thuật giao cho architecture.

### Privacy và data governance

- NFR-11: Analytics ưu tiên aggregate data, không lập hồ sơ người dùng trên nhiều website.
- NFR-12: Raw click log được giữ tối đa 30 ngày, sau đó phải xóa; aggregate totals, daily series và breakdowns được giữ không thời hạn trong MVP cho link active, kể cả sau khi raw log bị xóa. Aggregate của link đã xóa được giữ nhưng ẩn khỏi dashboard.
- NFR-13: Dashboard không hiển thị raw IP.
- NFR-14: City-level location phải được mô tả là estimated.

### Reliability

- NFR-15: Redirect không được thất bại chỉ vì không parse được referrer/device/browser/location.
- NFR-16: Link đã xóa phải trả HTTP 404, giữ **Tombstone** và không redirect tới destination cũ.

## 6. Non-Goals

- Không làm custom domain trong MVP.
- Không làm team workspace hoặc role-based access control phức tạp.
- Không làm QR code.
- Không làm bulk link creation.
- Không làm public API.
- Không làm A/B routing.
- Không làm password-protected links.
- Không làm link expiration.
- Không làm webhook/integration với công cụ marketing.
- Không làm billing/subscription.
- Không làm realtime analytics streaming.
- Không làm password reset trong MVP.

## 7. MVP Scope

### 7.1 In Scope

- Web dashboard cho marketer.
- Email/password auth.
- Google OAuth.
- Link CRUD.
- Rate limit tạo link theo tài khoản.
- Generated code path dạng `/{Code}`, ví dụ `/abac123`.
- Custom alias path dạng `/{Alias}`.
- URL destination validation.
- Public redirect.
- Click event capture.
- UTM builder với `utm_source`, `utm_medium`, `utm_campaign`.
- Analytics dashboard refresh theo request.
- Analytics theo tổng click, ngày, referrer, country, city, device, browser, `utm_source`, `utm_medium`, `utm_campaign`.
- Aggregate-first privacy boundary.

### 7.2 Out of Scope for MVP

- Custom domain — để sau vì user chọn chưa cần.
- Workspace nhiều thành viên — để sau vì MVP chỉ cần marketer account ownership.
- Realtime analytics — để sau vì refresh theo request đủ.
- UTM templates — để sau khi có nhu cầu campaign lặp lại.
- Deep abuse detection — MVP chỉ có validation và rate limit tạo link; phát hiện phishing/malware nâng cao để sau.

## 8. Success Metrics

### Primary

- **SM-1:** Link creation success — marketer tạo được short link hợp lệ với hoặc không có alias. Validates FR-4, FR-5.
- **SM-2:** Redirect correctness — 100% short link active redirect tới đúng destination hiện tại trong manual/E2E test. Validates FR-10.
- **SM-3:** Analytics usefulness — dashboard hiển thị total clicks, by day, referrer, country, city, device, browser cho link có click test. Validates FR-11, FR-13, FR-14, FR-15.
- **SM-4:** Campaign attribution — UTM builder tạo URL có `utm_source`, `utm_medium`, `utm_campaign`; redirect giữ nguyên UTM; dashboard breakdown/filter theo ba UTM dimensions. Validates FR-12, FR-15.
- **SM-5:** Abuse throttling — request tạo link vượt ngưỡng bị từ chối bằng HTTP 429 và không tạo dữ liệu. Validates FR-9.

### Secondary

- **SM-6:** Auth coverage — marketer có thể dùng email/password và Google OAuth để vào dashboard. Validates FR-1, FR-2, FR-3.
- **SM-7:** Task usability — trong usability check với dữ liệu seeded, marketer không cần hỗ trợ kỹ thuật để tạo hai campaign links theo kênh và xác định đúng kênh có nhiều click hơn. Validates UJ-1, FR-4, FR-5, FR-12, FR-13, FR-15.
- **SM-8:** Analytics reconciliation — tập click test hợp lệ, sau khi loại bot/link preview đã nhận diện, phải khớp 100% với aggregate trong vòng 60 giây. Validates FR-11, FR-13, FR-14, FR-15, FR-16.
- **SM-9:** System-design clarity — demo checklist phải giải thích được redirect path, event idempotency, aggregation, retention, ownership và failure isolation. Hệ thống cung cấp benchmark evidence cho NFR-1–NFR-3 và security review evidence cho NFR-4–NFR-10.

### Counter-metrics

- **SM-C1:** Không tối ưu số lượng analytics dimensions bằng cách lưu/hiển thị dữ liệu cá nhân thô. Counterbalances SM-3.
- **SM-C2:** Không tối ưu số lượng OAuth providers trong MVP. Counterbalances SM-6.
- **SM-C3:** Không tối ưu realtime dashboard. Counterbalances SM-3, SM-8.

## 9. PRD sequencing guidance

1. Link model và redirect flow.
2. Authentication và link ownership.
3. Click event capture.
4. Aggregation và retention policy.
5. Dashboard analytics.
6. UTM builder.
7. Google OAuth.

## 10. Open Questions

Không còn câu hỏi chặn phase tiếp theo.

## 11. Assumptions Index

- §2.3 UJ-1 — Linh là persona đại diện vì người dùng không cung cấp journey cụ thể.
- §2.3 UJ-2 — Minh là persona phụ cho flow sửa link.
- §4.1 — Admin không có UI riêng trong MVP.
Không còn assumption chặn phase tiếp theo. Tên persona Linh và Minh chỉ là dữ liệu minh họa cho journeys, không phải product decision.
