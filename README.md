# URL Shortener System

## Chạy local bằng Docker

Yêu cầu: Docker Desktop đang chạy và Docker Compose v2.

### 1. Tạo cấu hình local

```bash
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Chạy lệnh Node hai lần. Gán một giá trị cho `POSTGRES_PASSWORD`, giá trị còn lại cho `BETTER_AUTH_SECRET` trong `.env`. Không commit `.env`.

`BETTER_AUTH_SECRET` phải dài ít nhất 32 ký tự. `POSTGRES_PASSWORD` nên chỉ dùng ký tự URL-safe vì được đặt trong `DATABASE_URL`. Local giữ `TRUSTED_PROXY_HOPS=0`; production Render bắt buộc `TRUSTED_PROXY_HOPS=1` để Express chỉ lấy client IP qua đúng một load-balancer hop.

### 2. Build và khởi động

```bash
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps --all
```

Compose chờ PostgreSQL healthy, chạy migration một lần, rồi mới khởi động ứng dụng. Trạng thái mong đợi:

- `postgres`: `healthy`
- `migrate`: `Exited (0)`
- `app`: `healthy`

Mở `http://127.0.0.1:3000`. NestJS phục vụ React SPA và API cùng origin.

Đăng ký tại `/sign-up`, sau đó mở link email tại `/verify-email?token=...`. Tài khoản không tự đăng nhập và phải xác minh trước khi tạo session. Browser chỉ gọi facade cùng origin:

- `POST /api/registration/sign-up`
- `POST /api/registration/resend-verification`
- `POST /api/registration/verify-email`
- `POST /api/authentication/sign-in`
- `POST /api/authentication/sign-out`

Các mutation yêu cầu exact `Origin` và `Sec-Fetch-Site: same-origin`. Cooldown và login throttle trả `429` với `Retry-After`; không gọi trực tiếp raw Better Auth lifecycle routes.

### Google sign-in

Local có thể để trống cả `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`; ứng dụng sẽ không quảng cáo Google sign-in. Nếu bật, phải đặt đủ cặp này và đăng ký duy nhất tại Google Cloud:

- Authorized JavaScript origin: `PUBLIC_ORIGIN` chính xác.
- Authorized redirect URI: `${PUBLIC_ORIGIN}/api/auth/callback/google` chính xác.

Không dùng wildcard, callback khác hoặc trailing slash. Production bắt buộc HTTPS, một trusted proxy hop và đủ Google credentials từ secret store. `app` nhận Google credentials; `migrate` và `worker` không nhận chúng. Google authorization-code flow dùng Better Auth `state` và PKCE S256; `nonce`, cryptographic ID-token validation và atomic state-consume vẫn deferred. OAuth token không được lưu sau sign-in nên không hỗ trợ Google API hoặc refresh token.

### 3. Kiểm tra

```bash
curl.exe -fsS http://127.0.0.1:3000/health/live
curl.exe -fsS http://127.0.0.1:3000/health/ready
curl.exe -i http://127.0.0.1:3000/api/me
docker compose run --rm migrate
```

Fresh setup chưa đăng nhập phải trả `401` cùng `application/problem+json` cho `/api/me`. Lệnh migration cuối phải thoát `0`; đây là kiểm tra idempotence.

### 4. Logs và worker

```bash
docker compose logs --no-color postgres migrate app
docker compose --profile worker up -d worker
```

Worker xử lý outbox xác minh email và không chạy mặc định. `EMAIL_DELIVERY_MODE=capture` chỉ đánh dấu delivery đã xử lý, phù hợp local smoke test. Để gửi thật, đặt `EMAIL_DELIVERY_MODE=resend`, `EMAIL_FROM` và `RESEND_API_KEY`; không truyền provider secret vào service `app`. Worker retry tối đa ba provider attempts với fenced lease, rồi redacts delivery URL ở trạng thái `sent`/`dead`.

### 5. Chạy integration tests với PostgreSQL Docker

Từ host Windows/Git Bash:

```bash
set -a
. ./.env
set +a
INTEGRATION_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}" npm test
```

Role local do image PostgreSQL tạo có quyền tạo/xóa database tạm cho integration tests.

### 6. Dừng và reset

Giữ dữ liệu:

```bash
docker compose down
```

Xóa volume và toàn bộ dữ liệu local — không thể hoàn tác:

```bash
docker compose down -v
```

### Xử lý lỗi phổ biến

- Docker daemon không phản hồi: mở Docker Desktop, rồi chạy lại `docker version`.
- Cổng PostgreSQL `5432` bị chiếm: đặt `POSTGRES_PORT=5433` trong `.env`; container vẫn dùng `postgres:5432`.
- Cổng app `3000` bị chiếm: đổi đồng thời `APP_PORT=3001` và `PUBLIC_ORIGIN=http://127.0.0.1:3001`.
- Migration lỗi: chạy `docker compose logs --no-color postgres migrate`; không khởi động app bằng `--no-deps` để bỏ qua schema gate.
- Đổi `POSTGRES_*` không thay đổi database trong volume đã khởi tạo. Chỉ xóa volume sau khi chấp nhận mất dữ liệu local.
