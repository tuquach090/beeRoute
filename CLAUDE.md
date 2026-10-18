# CLAUDE.md – BeeRoute (MVP)

> File này hướng dẫn Claude Code xây dựng BeeRoute. Đọc hết trước khi viết dòng code đầu tiên.
> Ngôn ngữ giao tiếp với chủ dự án: **tiếng Việt**, xưng hô thân mật, ngắn gọn.
>
> Cập nhật 18/10/2026, sau khi xong Giai đoạn 0–5. Các mục mô tả **hiện trạng**, không
> phải dự định. Chỗ nào code khác file này thì code đúng — sửa file này lại.

---

## 1. Bối cảnh

- **BeeRoute** là ứng dụng web giúp người giao hàng **sắp xếp thứ tự các điểm giao sao cho tổng quãng đường ngắn nhất**, rồi mở tuyến đã tối ưu trên Google Maps để chạy.
- Giai đoạn này là **MVP cho chính chủ dự án dùng hằng ngày** (một shipper chạy xe máy ở TP.HCM, mỗi ngày 2 chuyến, mỗi chuyến khoảng 5–10 điểm). Chưa làm multi-tenant, chưa làm SaaS.
- Người dùng chủ yếu thao tác **trên điện thoại, một tay, ngoài đường**. Mọi quyết định UI phải ưu tiên điều này.

## 2. Công nghệ

| Phần | Lựa chọn |
|---|---|
| Frontend | **Next.js 16** (App Router), **TypeScript** strict |
| Style | **Tailwind CSS v4** (cấu hình bằng `@theme` trong CSS, không có `tailwind.config`) |
| Component | **shadcn/ui** — preset `radix-nova`, code nằm trong `src/components/ui/` |
| Backend/DB | **Supabase**: Auth (Google OAuth) + Postgres + Row Level Security |
| Kết nối Supabase | `@supabase/supabase-js` + `@supabase/ssr` (cookie-based session) |
| Form | `react-hook-form` + `zod` |
| Test | `vitest` cho toàn bộ logic thuần |
| Deploy | Vercel (FE) + Supabase Cloud (gói free) |

Không thêm thư viện ngoài danh sách này nếu chưa hỏi chủ dự án.

**Supabase là dịch vụ ngoài duy nhất.** Không gọi API bản đồ, geocoding hay gì khác.

Hai chỗ lệch so với cách làm thông thường, có lý do:

- **Không dùng `@hookform/resolvers`.** Peer dependency của nó đòi zod v3, trong khi
  `shadcn` kéo zod v4 — xung đột không gỡ được. Thay bằng
  `src/lib/validation/zod-resolver.ts`, khoảng 30 dòng.
- **`cacheComponents` tắt** trong `next.config.ts`. Mọi màn hình đều nằm sau đăng nhập và
  đọc dữ liệu riêng từng người, nên bật nó chỉ bắt mọi route phải bọc `<Suspense>` mà
  không cache được gì. Đáng bật lại nếu sau này có phần tìm công ty `is_public` — truy vấn
  đó giống nhau với mọi người.

## 3. Quy tắc làm việc cho Claude Code

1. **Làm theo đúng thứ tự giai đoạn** ở mục 9. Không nhảy sang giai đoạn sau khi giai đoạn trước chưa được chủ dự án xác nhận.
2. Mỗi giai đoạn xong: tóm tắt ngắn đã làm gì, cách chạy thử, và những gì còn thiếu.
3. Không tự ý lưu kết quả tối ưu tuyến vào database (xem mục 7).
4. Không commit file `.env*` hay key bí mật. Có file `.env.example` liệt kê đủ biến.
5. Code, tên biến, tên file bằng **tiếng Anh**. Chữ hiển thị trên giao diện bằng **tiếng Việt**, gom hết vào `src/lib/i18n/vi.ts`.
6. Có gì chưa rõ thì **hỏi**, đừng đoán ở những chỗ ảnh hưởng tới dữ liệu hoặc luồng chính.
7. **Không bao giờ sửa migration đã chạy.** Viết migration mới.
8. **Một hàm Postgres chỉ được định nghĩa ở đúng một migration.** `create or replace` với
   cùng chữ ký thì cái chạy sau đè cái trước, nên hai migration cùng khai báo một hàm sẽ
   cho kết quả khác nhau tuỳ thứ tự chạy. Đã dính lỗi này một lần với `save_company`
   (002 và 003 cùng khai báo, phải thêm 004 để chữa).
9. Sửa logic thuần thì **viết test trước khi báo xong**. Chạy `npm test`.

## 4. Giai đoạn 0 — các quyết định thiết kế (ĐÃ CHỐT)

Chi tiết đầy đủ, kèm bảng màu và lý do, nằm ở **[docs/design.md](docs/design.md)**.

| # | Câu hỏi | Đã chốt |
|---|---|---|
| 1 | Ưu tiên thiết bị | Mobile-first, nhắm 390px; desktop chỉ cần không vỡ |
| 2 | Phong cách | Thẻ bo góc lớn, viền rõ, màu thương hiệu mạnh, bố cục gọn |
| 3 | Sáng / tối | **Làm cả hai**, có nút đổi ở thanh đầu trang |
| 4 | Font | Be Vietnam Pro, số dùng tabular |
| 5 | Điều hướng | Thanh tab dưới đáy: Tuyến đường / Công ty |
| 6 | Bản đồ trong app | Không làm |
| 7 | Nút hành động chính | Cố định dưới đáy, cao ≥ 52px |
| 8 | Phương tiện mặc định | Xe máy (`two-wheeler`), đổi được sang ô tô |
| — | Thư viện component | shadcn/ui |

### Thương hiệu

- Tên: **BeeRoute** – "Tối ưu tuyến giao hàng".
- Logo: con ong thân là ghim định vị, bay theo đường chấm. File ở `public/brand/`
  (`BeeRoute-icon.svg`, PNG 1024/512/192, `favicon-64.png`).
  Dùng trong app qua component `src/components/logo.tsx`.
- Màu: xanh `#2F5BEA`, vàng mật `#FFC21A`, đen than `#1C1A17`, xanh nhạt `#E8F0FF`.
- Tương phản chữ tối thiểu 4.5:1. **Trên nền vàng luôn dùng chữ đen than** (chữ trắng chỉ
  đạt 1.9:1). Kiểm tra bằng `npm run check:contrast` — đổi màu thì chạy lại trước khi commit.

## 5. Chức năng MVP

### 5.1 Đăng nhập (bắt buộc) — ĐÃ LÀM

- **Toàn bộ app yêu cầu đăng nhập.** Chưa đăng nhập thì mọi đường dẫn đều chuyển về `/login`.
- Chỉ có **Đăng nhập bằng Google** (Supabase Auth). Chưa làm email/mật khẩu.
- Luồng: `/login` → Google → `/auth/callback` → về `/`.
- Bảo vệ hai lớp: `middleware.ts` **và** kiểm tra lại session trong `(app)/layout.tsx`.
  Middleware có thể thủng do matcher cấu hình sai, kiểm tra phía server thì không.
- Luôn dùng `getUser()`, **không dùng `getSession()`** — `getSession()` chỉ giải mã cookie,
  client giả được.
- Đăng xuất: `POST /auth/signout` (dùng POST để prefetch không làm đăng xuất nhầm).

### 5.2 Trang chính: Tối ưu tuyến (`/`) — ĐÃ LÀM

**a) Điểm bắt đầu** (bắt buộc), chọn 1 trong 2:
- **Vị trí hiện tại**: Geolocation API, lấy **đúng lúc bấm Tối ưu** chứ không dùng toạ độ cũ.
  Có xử lý từ chối quyền / quá hạn / trình duyệt không hỗ trợ.
- **Nhập địa chỉ**: dán link Google Maps hoặc toạ độ (xem mục 8).

**b) Các điểm đến** (bắt buộc ít nhất 1):
- Nút **"+ Thêm điểm đến"** → bottom sheet danh sách công ty, có ô tìm theo tên/địa chỉ,
  chọn nhiều bằng checkbox, bấm "Xong". Huỷ thì không áp dụng gì.
- Chưa có công ty nào hoặc không tìm thấy → nút **"Tạo công ty mới"** →
  `/companies/new?returnTo=/`.
- Tạo xong quay lại thì **giữ nguyên lựa chọn cũ** và **tự chọn sẵn công ty vừa tạo**
  (`?added=<id>`). Trạng thái form nằm trong `sessionStorage`, quản lý ở
  `src/lib/route-draft.ts`.

**c) Điểm kết thúc** (bắt buộc): giống điểm bắt đầu.

**d) Phương tiện**: xe máy / ô tô.

**e) Nút "Tối ưu tuyến"** → chạy module mục 6 **ngay trên trình duyệt**, không gọi server.

**f) Kết quả** hiện ngay trên trang: thứ tự đã tối ưu, khoảng cách từng chặng, tổng km
(ghi rõ là đường chim bay), số điện thoại bấm gọi được (`tel:`), ghi chú của công ty,
và nút **"Mở trên Google Maps"**.

### 5.3 Quản lý công ty — ĐÃ LÀM

**Danh sách** `/companies` · **Tạo** `/companies/new` · **Sửa** `/companies/[id]/edit`

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| Tên hiển thị | ✅ | Tối đa 120 ký tự |
| Địa chỉ | ✅ | **Bắt buộc có toạ độ** mới lưu được (xem mục 8) |
| Liên hệ | ❌ | Nhiều dòng. Mỗi dòng: tên người/phòng ban + số điện thoại |
| Ghi chú | ❌ | Việc cần làm khi tới nơi |
| Cho người khác tìm thấy | ❌ | Cờ `is_public`, mặc định tắt (xem mục 7) |

- **Một dòng liên hệ chỉ cần có tên HOẶC có số** — cả hai đều không bắt buộc. Dòng trống
  cả hai thì bị bỏ khi lưu, không tạo bản ghi rác.
- Số điện thoại có nhập thì phải đúng định dạng VN: 10–11 số bắt đầu bằng `0`, hoặc `+84`.
  Chấp nhận dấu cách, gạch, ngoặc — sẽ được chuẩn hoá trước khi lưu.
- Lưu xong: có `returnTo` thì quay về đó kèm `?added=<id>`, không thì về `/companies`.
- Xoá công ty: có hộp xác nhận.

## 6. Module tối ưu tuyến — ĐÃ LÀM

`src/lib/route-optimizer/`. **Thuần TypeScript**, không phụ thuộc React, Next.js hay
Supabase. Test ở `optimize.test.ts`.

### 6.1 Giao diện hàm

```ts
type LatLng = { lat: number; lng: number };
type Stop = { id: string; label: string; location: LatLng };

type OptimizeInput = { start: LatLng; stops: Stop[]; end: LatLng };

type OptimizeResult = {
  orderedStops: Stop[];
  legsKm: number[];   // start→stop1, …, stopN→end. Luôn = orderedStops.length + 1
  totalKm: number;
  method: "exact" | "heuristic";
};

export function optimizeRoute(input: OptimizeInput): OptimizeResult;
```

### 6.2 Thuật toán

- Khoảng cách **Haversine** (km, bán kính 6371). Ma trận tính sẵn một lần.
- Điểm đầu và cuối cố định — đây là bài toán **đường đi mở**, không phải chu trình.
- **≤ 8 điểm đến** (`EXACT_MAX_STOPS`): duyệt mọi hoán vị, có **cắt nhánh** — bỏ ngay
  nhánh nào đã đắt hơn lời giải tốt nhất hiện có. `method: "exact"`.
- **> 8 điểm**: Nearest Neighbor để có lời giải ban đầu, rồi **2-opt** tới khi không giảm
  được nữa. `method: "heuristic"`.
- Luôn ghi rõ trong code và trên giao diện: đây là **khoảng cách đường chim bay**, chỉ dùng
  để sắp thứ tự. Đường đi thật do Google Maps tính.

### 6.3 Tạo link Google Maps

`src/lib/google-maps/build-links.ts`, test ở `build-links.test.ts`. Không cần API key.

```
https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=…|…&travelmode=two-wheeler
```

**Mỗi điểm dừng gửi đi dưới dạng nào** — đây là chỗ dễ gây hại nhất trong dự án:

| Dữ liệu có | Gửi sang Google |
|---|---|
| Địa chỉ thật | `"Tên công ty, địa chỉ"` → Maps hiện tên đọc được |
| Địa chỉ chỉ là toạ độ | `lat,lng` → Maps hiện "Đã thả ghim" |

Gửi chuỗi chữ nghĩa là **Google tự tìm lại địa điểm từ chữ đó**. Chữ đúng thì ra tên đẹp,
chữ sai thì dẫn tài xế tới chỗ khác. Nên chỉ gửi chữ khi chữ đó đến từ nguồn đáng tin
(mục 8). Thiếu dữ kiện thì luôn lùi về toạ độ: **một điểm đúng mà không tên vẫn hơn một
cái tên dẫn sai chỗ**.

Điểm đầu và cuối luôn gửi toạ độ — chúng đến từ GPS hoặc người dùng gõ, không có bản ghi
công ty nào đứng sau.

Toạ độ làm tròn 6 chữ số (~11cm) để URL không dính nhiễu dấu phẩy động.

**Giới hạn waypoint**: `MAX_WAYPOINTS_PER_LINK = 8`. Vượt thì chia nhiều chặng, điểm cuối
chặng trước là điểm đầu chặng sau, hiện nhiều nút "Mở chặng 1", "Mở chặng 2"…

## 7. Dữ liệu (Supabase)

**Chỉ lưu công ty và liên hệ. KHÔNG lưu kết quả tối ưu tuyến.**

Schema đầy đủ: `supabase/migrations/`. Giải thích lý do: **[docs/database.md](docs/database.md)**.

Ba bảng: `profiles` (thông tin cơ bản lấy từ Google, tạo tự động bằng trigger khi đăng nhập
lần đầu), `companies`, `company_contacts`.

Khác với bản đặc tả ban đầu:

- `companies` có thêm cột **`is_public boolean not null default false`**.
  Đặt tên `is_public` chứ không phải `public` vì `public` cũng là tên schema trong Postgres.
- `company_contacts.phone` **cho phép NULL** (mục 5.3).

### `is_public` công khai những gì

> **Quyết định của chủ dự án: công khai TẤT CẢ.** `is_public = true` thì mọi người dùng đã
> đăng nhập đọc được toàn bộ công ty đó, **kể cả số điện thoại và ghi chú nội bộ**.

Rủi ro đã được nêu trước khi làm và chủ dự án vẫn chọn phương án này. Đây là **hành vi cố
ý, không phải lỗi**. Muốn siết lại thì sửa đúng hai policy, xem `docs/database.md`.

### RLS

Bật trên cả ba bảng, không có policy nào cho vai trò `anon`.

| Bảng | Đọc | Ghi |
|---|---|---|
| `profiles` | dòng của mình | dòng của mình; insert do trigger |
| `companies` | của mình **hoặc** `is_public` | chỉ chủ sở hữu |
| `company_contacts` | theo quyền đọc công ty cha | chỉ chủ sở hữu công ty cha |

### Lưu công ty

Qua RPC **`save_company`** — insert/update công ty và ghi lại toàn bộ danh sách liên hệ
trong **một transaction**. Hàm **không** dùng `security definer`, nên RLS vẫn áp dụng đầy đủ.

Hàm này hiện được định nghĩa ở migration `004`. Nếu cần sửa, viết migration mới và **xoá
định nghĩa ở các migration cũ** — xem quy tắc 3.8.

### Type TypeScript

`src/types/database.ts` đang **viết tay** cho khớp migration. Có project rồi thì nên thay bằng:

```bash
npx supabase gen types typescript --project-id <ref> > src/types/database.ts
```

## 8. Vị trí (toạ độ) — KHÔNG DÙNG DỊCH VỤ GEOCODING

> Mục này đã thay đổi hoàn toàn so với bản đặc tả đầu. Trước đây dùng Nominatim
> (OpenStreetMap) qua `/api/geocode`. **Đã gỡ bỏ toàn bộ.**

Lý do: luồng thật của người dùng là **tìm địa điểm trên Google Maps trước rồi mới thêm vào
app**. Link Google Maps đã chứa sẵn cả tên Google đặt cho chỗ đó lẫn toạ độ chính xác, nên
một bộ geocoding thứ hai không thêm được gì mà lại tạo ra một cách để hai bên mâu thuẫn —
và nó đã xảy ra: Nominatim tra ngược toạ độ của một công ty may ra tên một trường học gần
đó, rồi chính cái tên sai ấy được gửi sang Google khi dẫn đường.

Toàn bộ logic nằm ở `src/lib/geocoding/parse-location.ts`, chạy bằng regex **trong trình
duyệt**, không gọi mạng. Test ở `parse-location.test.ts`.

| Người dùng nhập | Kết quả |
|---|---|
| Link `/maps/place/<tên>/@lat,lng` | Tên Google + toạ độ |
| Link `/maps/@lat,lng` hoặc `?q=lat,lng` | Toạ độ |
| `10.749046, 106.635174` (phẩy, chấm phẩy, hoặc space) | Toạ độ |
| Link rút gọn `maps.app.goo.gl/...` | Báo lỗi, bảo mở ra lấy link đầy đủ |
| Chữ thường | Giữ toạ độ đang có; chưa có thì không lưu được |

Hai hành vi quan trọng:

- **Dán link thì ô nhập đổi ngay thành tên/toạ độ**, không bao giờ giữ nguyên URL dài. Nếu
  giữ, chính cái URL sẽ bị lưu làm địa chỉ.
- **Sửa chữ không làm mất toạ độ.** Tên Google trả về thường dài, người dùng hay rút gọn
  lại. Toạ độ chỉ mất khi xoá trắng ô.

Nếu sau này cần tìm theo tên trong app, dùng **Google Places API** (tốn phí, cần key) —
đừng quay lại Nominatim.

## 9. Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| **0. UI/UX** | design tokens, 4 màn hình | ✅ xong, đã duyệt |
| **1. Khởi tạo** | Next + TS + Tailwind + lint/format, Supabase, `.env.example`, logo | ✅ xong |
| **2. Đăng nhập** | Google OAuth, callback, middleware, đăng xuất | ✅ xong |
| **3. Công ty** | Migration + RLS, CRUD, liên hệ nhiều dòng, nhập vị trí | ✅ xong |
| **4. Tối ưu tuyến** | Module `route-optimizer` + test, trang chính | ✅ xong |
| **5. Google Maps** | `buildGoogleMapsLinks` + test, chia chặng | ✅ xong |
| **6. Hoàn thiện** | Trạng thái loading/lỗi/rỗng, kiểm tra trên điện thoại thật | ⏳ đang làm |

Đã deploy: GitHub `tuquach090/beeRoute` → Vercel tự build khi push `main`.

## 10. Cấu trúc thư mục

```
src/
  app/
    login/page.tsx
    auth/callback/route.ts          đổi code lấy session
    auth/signout/route.ts           POST
    auth/auth-code-error/page.tsx
    (app)/                          nhóm route sau đăng nhập
      layout.tsx                    header + thanh tab + chặn session
      page.tsx                      tối ưu tuyến
      companies/page.tsx
      companies/new/page.tsx
      companies/[id]/edit/page.tsx
  components/
    ui/                             shadcn, không sửa tay
    route-form.tsx  company-form.tsx  company-picker-sheet.tsx
    address-input.tsx  account-menu.tsx  bottom-tabs.tsx
    logo.tsx  theme-script.tsx  theme-toggle.tsx  google-*.tsx
  lib/
    supabase/                       client / server / middleware / env
    companies/                      queries.ts (đọc) + actions.ts (ghi)
    route-optimizer/                thuần TS + test
    google-maps/                    build-links + test
    geocoding/                      parse-location + test (regex, không gọi mạng)
    validation/                     zod schema + resolver tự viết + test
    i18n/vi.ts                      toàn bộ chữ tiếng Việt
    route-draft.ts                  sessionStorage store cho form tuyến
    use-current-location.ts         Geolocation API
  types/database.ts
middleware.ts
supabase/migrations/
scripts/check-contrast.mjs
docs/design.md  docs/database.md
```

## 11. Biến môi trường (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Chỉ hai biến. Không có key nào khác vì Supabase là dịch vụ ngoài duy nhất.

Chỉ dùng key **anon public**. Key `service_role` bỏ qua mọi RLS — không bao giờ đặt vào
biến có tiền tố `NEXT_PUBLIC_`.

Cấu hình Google OAuth và các bước deploy: xem **[README.md](README.md)**.

## 12. Chưa làm (để sau)

- Đăng ký bằng email/mật khẩu.
- Giao diện tìm và thêm công ty `is_public` của người khác (cờ đã có trong DB và RLS, chưa có màn hình).
- Nhiều người dùng chung một công ty (multi-tenant), phân quyền điều phối/tài xế.
- Lưu lịch sử các tuyến, thống kê, tính lương theo chuyến.
- Khoảng cách theo đường thật (OSRM/Google Directions), giờ mở cửa, khung giờ giao.
- Seed dữ liệu mẫu (cần `user_id` thật nên phải có người đăng nhập trước).
- PWA cài lên màn hình chính, dùng offline.
- Bộ đếm ký tự cho ô "Tên hiển thị".
