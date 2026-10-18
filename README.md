# BeeRoute

Sắp xếp thứ tự các điểm giao sao cho tổng quãng đường ngắn nhất, rồi mở tuyến đã
tối ưu trên Google Maps.

Next.js (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase

---

## Chạy dự án

```bash
npm install
cp .env.example .env.local   # rồi điền giá trị, xem bên dưới
npm run dev
```

Mở http://localhost:3000 — chưa đăng nhập sẽ tự chuyển về `/login`.

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build production |
| `npm start` | Chạy bản đã build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier, ghi đè file |
| `npm run format:check` | Prettier, chỉ kiểm tra |
| `npm run check:contrast` | Kiểm tra tương phản màu đạt WCAG |

> **Không có `.env.local` thì app sẽ báo lỗi ngay.** Đó là cố ý — thà hỏng lúc
> khởi động còn hơn chạy được rồi mới lặng lẽ sai khi gọi database.

---

## Thiết lập Supabase

Làm một lần. Khoảng 10 phút.

### 1. Tạo project

1. Vào https://supabase.com → **New project**.
2. Chọn region **Southeast Asia (Singapore)** cho gần TP.HCM.
3. Đặt mật khẩu database và **lưu lại** — Supabase không cho xem lại.

### 2. Lấy key cho `.env.local`

**Project Settings → API**, chép hai giá trị:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

Chỉ cần hai biến này. App không gọi dịch vụ bản đồ nào khác — vị trí lấy từ
link Google Maps bạn dán vào.

Chỉ dùng key **anon public**. Key `service_role` bỏ qua mọi quy tắc RLS, không
bao giờ đưa vào file có tiền tố `NEXT_PUBLIC_` (Next sẽ nhúng thẳng vào
JavaScript gửi xuống trình duyệt).

### 3. Chạy migration

Cách nhanh: **SQL Editor → New query**, dán toàn bộ nội dung
`supabase/migrations/20261018000001_init.sql` rồi **Run**.

Cách dùng CLI (nếu sau này muốn quản lý migration tử tế hơn):

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Kiểm tra: **Table Editor** phải thấy 3 bảng `profiles`, `companies`,
`company_contacts`, và cột **RLS enabled** đều bật.

### 4. Bật đăng nhập Google

**a) Google Cloud Console** — https://console.cloud.google.com

1. Tạo project (hoặc chọn project có sẵn).
2. **APIs & Services → OAuth consent screen**: chọn **External**, điền tên app
   và email. Ở phần **Test users**, thêm email Gmail của bạn — nếu không, app ở
   chế độ Testing sẽ từ chối đăng nhập.
3. **Credentials → Create credentials → OAuth client ID**, loại **Web application**.
4. **Authorized redirect URIs** — thêm đúng URI này:

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   Đây là callback của **Supabase**, không phải của app. Người ta hay nhầm chỗ này.

5. Chép **Client ID** và **Client secret**.

**b) Supabase Dashboard**

1. **Authentication → Providers → Google**: bật lên, dán Client ID + Client secret, **Save**.
2. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (khi deploy thì đổi thành domain thật)
   - **Redirect URLs**: thêm cả hai dòng
     ```
     http://localhost:3000/**
     https://<domain-khi-deploy>/**
     ```

### 5. Thử

```bash
npm run dev
```

Vào http://localhost:3000 → bị đẩy về `/login` → bấm **Đăng nhập bằng Google** →
chọn tài khoản → quay lại trang chính, góc phải header hiện ảnh đại diện.

Vào **Table Editor → profiles**, phải thấy một dòng vừa được tạo tự động.

---

## Khi deploy lên Vercel

1. Thêm `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` vào
   **Environment Variables** của project.
2. Quay lại Supabase → **Authentication → URL Configuration**, đổi **Site URL**
   thành domain thật và thêm `https://<domain>/**` vào Redirect URLs.

Không cần sửa gì trong Google Cloud Console — redirect URI vẫn trỏ về Supabase.

---

## Tài liệu

| File | Nội dung |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Đặc tả dự án và quy tắc làm việc |
| [docs/design.md](docs/design.md) | Quyết định thiết kế, bảng màu, design tokens |
| [docs/database.md](docs/database.md) | Schema, RLS, và ý nghĩa cờ `is_public` |
