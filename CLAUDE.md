# CLAUDE.md – BeeRoute (MVP)

> File này hướng dẫn Claude Code xây dựng BeeRoute. Đọc hết trước khi viết dòng code đầu tiên.
> Ngôn ngữ giao tiếp với chủ dự án: **tiếng Việt**, xưng hô thân mật, ngắn gọn.

---

## 1. Bối cảnh

- **BeeRoute** là ứng dụng web giúp người giao hàng **sắp xếp thứ tự các điểm giao sao cho tổng quãng đường ngắn nhất**, rồi mở tuyến đã tối ưu trên Google Maps để chạy.
- Giai đoạn này là **MVP cho chính chủ dự án dùng hằng ngày** (một shipper chạy xe máy ở TP.HCM, mỗi ngày 2 chuyến, mỗi chuyến khoảng 5–10 điểm). Chưa làm multi-tenant, chưa làm SaaS.
- Người dùng chủ yếu thao tác **trên điện thoại, một tay, ngoài đường**. Mọi quyết định UI phải ưu tiên điều này.

## 2. Công nghệ

| Phần             | Lựa chọn                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| Frontend         | **Next.js** (App Router, bản ổn định mới nhất), **TypeScript** strict      |
| Style            | **Tailwind CSS**; thư viện component chốt ở Giai đoạn 0 (gợi ý: shadcn/ui) |
| Backend/DB       | **Supabase**: Auth (Google OAuth) + Postgres + Row Level Security          |
| Kết nối Supabase | `@supabase/supabase-js` + `@supabase/ssr` (cookie-based session)           |
| Form             | `react-hook-form` + `zod`                                                  |
| Test             | `vitest` cho phần logic tối ưu tuyến                                       |
| Deploy           | Vercel (FE) + Supabase Cloud (gói free)                                    |

Không thêm thư viện ngoài danh sách này nếu chưa hỏi chủ dự án.

## 3. Quy tắc làm việc cho Claude Code

1. **Làm theo đúng thứ tự giai đoạn** ở mục 9. Không nhảy sang giai đoạn sau khi giai đoạn trước chưa được chủ dự án xác nhận.
2. **Giai đoạn 0 (UI/UX) bắt buộc làm trước.** Đặt câu hỏi ở mục 4, chờ trả lời, rồi mới dựng giao diện.
3. Mỗi giai đoạn xong: tóm tắt ngắn đã làm gì, cách chạy thử, và những gì còn thiếu.
4. Không tự ý lưu kết quả tối ưu tuyến vào database (xem mục 7).
5. Không commit file `.env*` hay key bí mật. Có file `.env.example` liệt kê đủ biến.
6. Code, tên biến, tên file bằng **tiếng Anh**. Chữ hiển thị trên giao diện bằng **tiếng Việt** (gom vào một chỗ, ví dụ `src/lib/i18n/vi.ts`, để sau này dịch).
7. Có gì chưa rõ thì **hỏi**, đừng đoán ở những chỗ ảnh hưởng tới dữ liệu hoặc luồng chính.

## 4. Giai đoạn 0 – Hỏi chủ dự án về phong cách thiết kế

Trước khi code giao diện, hỏi lần lượt các câu dưới đây (dùng câu hỏi trắc nghiệm nếu công cụ cho phép), mỗi câu kèm **gợi ý mặc định** để chủ dự án chỉ cần đồng ý hoặc sửa:

| #   | Câu hỏi                                                                                                    | Gợi ý mặc định                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Thiết kế ưu tiên điện thoại hay máy tính?                                                                  | **Mobile-first**, màn hình chính tối ưu cho 390px; desktop chỉ cần không vỡ      |
| 2   | Phong cách tổng thể? (a) vui, kiểu sticker như icon; (b) gọn, chuyên nghiệp kiểu SaaS; (c) tối giản tối đa | **(a) pha (b)**: thẻ bo góc lớn, viền rõ, màu thương hiệu mạnh, nhưng bố cục gọn |
| 3   | Chế độ sáng/tối?                                                                                           | **Sáng** mặc định, chuẩn bị token màu để thêm chế độ tối sau                     |
| 4   | Font chữ?                                                                                                  | **Be Vietnam Pro** (hỗ trợ tiếng Việt tốt), số dùng tabular                      |
| 5   | Điều hướng chính?                                                                                          | **Thanh tab dưới đáy** 2 mục: "Tuyến đường", "Công ty"                           |
| 6   | Có cần bản đồ xem trước trong app không?                                                                   | **Chưa cần** ở MVP, chỉ danh sách thứ tự + nút mở Google Maps                    |
| 7   | Nút hành động chính đặt ở đâu?                                                                             | **Cố định dưới đáy màn hình**, to (cao ≥ 52px), dễ bấm bằng ngón cái             |
| 8   | Phương tiện mặc định khi mở Google Maps?                                                                   | **Xe máy** (`two-wheeler`), cho phép đổi sang ô tô                               |

Sau khi có câu trả lời:

- Tạo file `docs/design.md` ghi lại các quyết định.
- Tạo **design tokens** (màu, font, bo góc, khoảng cách) trong Tailwind config.
- Dựng **4 màn hình tĩnh** (dữ liệu giả) để chủ dự án duyệt: Đăng nhập, Tối ưu tuyến, Chọn công ty (dialog/sheet), Tạo công ty. Duyệt xong mới nối dữ liệu thật.

### Thương hiệu có sẵn

- Tên: **BeeRoute** – "Tối ưu tuyến giao hàng".
- Logo: con ong thân là ghim định vị, bay theo đường chấm. File nằm ở `public/brand/` (`BeeRoute-icon.svg`, các PNG 1024/512/192, favicon 64).
- Màu:
  - Xanh BeeRoute `#2F5BEA` (màu chính, nút chính)
  - Vàng mật `#FFC21A` (điểm nhấn, trạng thái được chọn)
  - Đen than `#1C1A17` (chữ)
  - Xanh nhạt `#E8F0FF` (nền phụ)
- Kiểm tra độ tương phản chữ tối thiểu 4.5:1. Chữ trắng trên vàng **không đạt**: trên nền vàng luôn dùng chữ đen than.

## 5. Chức năng MVP

### 5.1 Đăng nhập (bắt buộc)

- **Toàn bộ app yêu cầu đăng nhập.** Chưa đăng nhập thì mọi đường dẫn đều chuyển về `/login`.
- Chỉ có **Đăng nhập bằng Google** (Supabase Auth, provider Google). Chưa làm đăng ký bằng email/mật khẩu.
- Luồng: `/login` → Google → `/auth/callback` (đổi code lấy session) → về trang chính `/`.
- Bảo vệ route bằng `middleware.ts` + kiểm tra session phía server.
- Có nút **Đăng xuất** (trong menu tài khoản).

### 5.2 Trang chính: Tối ưu tuyến (`/`)

Form gồm 3 phần, từ trên xuống:

**a) Điểm bắt đầu** (bắt buộc), chọn 1 trong 2:

- **Vị trí hiện tại**: lấy bằng Geolocation API của trình duyệt. Xử lý khi người dùng từ chối quyền hoặc lấy vị trí thất bại (hiện thông báo, gợi ý nhập tay).
- **Nhập địa chỉ**: ô nhập có gợi ý địa chỉ (xem mục 8 – Geocoding), chọn xong phải có toạ độ.

**b) Các điểm đến** (bắt buộc ít nhất 1):

- Nút **"+ Thêm điểm đến"** → mở dialog (trên điện thoại là bottom sheet) hiển thị **danh sách công ty** đã lưu:
  - Có ô tìm kiếm theo tên hoặc địa chỉ.
  - **Chọn được nhiều công ty** cùng lúc (checkbox), bấm "Xong" để thêm.
  - Nếu chưa có công ty nào, hoặc không tìm thấy: hiện nút **"Tạo công ty mới"** → chuyển sang `/companies/new?returnTo=/`.
- Sau khi tạo công ty và quay lại: **giữ nguyên các lựa chọn trước đó** (điểm bắt đầu, các điểm đến đã chọn, điểm kết thúc) và **tự chọn sẵn công ty vừa tạo**. Lưu trạng thái form tạm trong `sessionStorage` để không mất khi chuyển trang.
- Danh sách điểm đến đã chọn hiện dạng thẻ, có nút xoá từng điểm.

**c) Điểm kết thúc** (bắt buộc), chọn 1 trong 2:

- **Vị trí hiện tại** (lấy lại lúc bấm tối ưu).
- **Nhập địa chỉ** (giống điểm bắt đầu).

**d) Nút "Tối ưu tuyến"** → chạy module tối ưu (mục 6) **ngay trên trình duyệt**, không gọi server.

**e) Kết quả** hiện ngay trên trang:

- Danh sách theo thứ tự đã tối ưu: Bắt đầu → 1 → 2 → … → Kết thúc, mỗi điểm có tên công ty, địa chỉ, khoảng cách từ điểm trước.
- Tổng quãng đường ước tính (km, ghi rõ là đường chim bay).
- Bấm vào một điểm để xem nhanh **liên hệ** (bấm số là gọi được, `tel:`) và **ghi chú** của công ty đó.
- Nút lớn **"Mở trên Google Maps"** → mở link chỉ đường với thứ tự đã tối ưu (mục 6.3).

### 5.3 Quản lý công ty

**Danh sách** `/companies`: tìm kiếm, bấm để sửa, nút tạo mới.

**Tạo / sửa** `/companies/new`, `/companies/[id]/edit`:

| Trường             | Bắt buộc | Ghi chú                                                                                               |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------------- |
| Tên hiển thị       | ✅       | Tối đa 120 ký tự                                                                                      |
| Địa chỉ (location) | ✅       | Ô nhập có gợi ý; **bắt buộc phải có toạ độ** (lat/lng) trước khi lưu                                  |
| Liên hệ            | ❌       | Danh sách, **thêm được nhiều dòng**. Mỗi dòng 2 ô: **Người liên hệ / phòng ban** và **Số điện thoại** |
| Ghi chú            | ❌       | Textarea: việc cần làm khi tới nơi (gọi ai, thủ tục vào cổng, có lấy mẫu không…)                      |

- Số điện thoại: kiểm tra định dạng Việt Nam cơ bản (10 số, bắt đầu bằng 0, hoặc +84), cho phép số bàn có mã vùng.
- Mỗi dòng liên hệ cần có ít nhất số điện thoại; tên có thể để trống.
- Lưu xong: nếu có `returnTo` thì quay về đó kèm id công ty mới (`?added=<id>`); không có thì về `/companies`.
- Xoá công ty: có hộp xác nhận.

## 6. Module tối ưu tuyến (viết riêng, không dùng API ngoài)

Vị trí: `src/lib/route-optimizer/`. **Thuần TypeScript**, không phụ thuộc React, Next.js hay Supabase, để sau này tái dùng ở backend.

### 6.1 Giao diện hàm

```ts
type LatLng = { lat: number; lng: number };
type Stop = { id: string; label: string; location: LatLng };

type OptimizeInput = {
  start: LatLng;
  stops: Stop[]; // các điểm đến, không trùng id
  end: LatLng; // điểm kết thúc cố định
};

type OptimizeResult = {
  orderedStops: Stop[];
  legsKm: number[]; // khoảng cách từng chặng: start→stop1, …, stopN→end
  totalKm: number;
  method: "exact" | "heuristic";
};

export function optimizeRoute(input: OptimizeInput): OptimizeResult;
```

### 6.2 Thuật toán

- Khoảng cách: **Haversine** (km, bán kính Trái Đất 6371 km). Tính sẵn ma trận khoảng cách một lần.
- Mục tiêu: **tổng quãng đường nhỏ nhất** với điểm đầu và điểm cuối cố định.
- **≤ 8 điểm đến**: thử mọi hoán vị (chính xác), `method: 'exact'`.
- **> 8 điểm đến**: **Nearest Neighbor** (từ điểm hiện tại đi tới điểm gần nhất chưa ghé, đúng ý "gần trước, xa sau") để có lời giải ban đầu, rồi cải thiện bằng **2-opt** tới khi không giảm được nữa, `method: 'heuristic'`.
- Các trường hợp biên: 0 điểm đến (báo lỗi), 1 điểm đến, các điểm trùng toạ độ.
- **Unit test bằng vitest**: các trường hợp biên, so kết quả heuristic với kết quả exact trên bộ dữ liệu nhỏ, và một bộ toạ độ thật ở TP.HCM.
- Ghi rõ trong code và trên giao diện: đây là **khoảng cách đường chim bay**, chỉ dùng để sắp thứ tự. Đường đi thật do Google Maps tính.

### 6.3 Tạo link Google Maps

Dùng Google Maps URLs (không cần API key):

```
https://www.google.com/maps/dir/?api=1
  &origin=<lat>,<lng>
  &destination=<lat>,<lng>
  &waypoints=<lat>,<lng>|<lat>,<lng>|…
  &travelmode=two-wheeler   // hoặc driving
```

- Dùng **toạ độ** thay vì chuỗi địa chỉ để Google không hiểu sai.
- Nhớ `encodeURIComponent` cho phần waypoints.
- **Giới hạn số waypoint**: Google Maps chỉ nhận số điểm dừng giới hạn trong một link (ít hơn trên trình duyệt điện thoại). Nếu vượt giới hạn thì **chia thành nhiều chặng**, hiện nhiều nút "Mở chặng 1", "Mở chặng 2"…, điểm cuối chặng trước là điểm đầu chặng sau. Để giới hạn này thành hằng số dễ chỉnh, và kiểm tra lại tài liệu Google Maps URLs lúc làm.
- Viết hàm riêng `buildGoogleMapsLinks(result, start, end, travelMode): string[]`, có unit test.

## 7. Dữ liệu (Supabase)

**Chỉ lưu thông tin công ty và liên hệ. KHÔNG lưu kết quả tối ưu tuyến.**

```sql
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  display_name  text not null check (char_length(display_name) between 1 and 120),
  address       text not null check (char_length(address) > 0),
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.company_contacts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  contact_name  text,            -- người liên hệ hoặc phòng ban
  phone         text not null,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

create index on public.companies (user_id);
create index on public.company_contacts (company_id);
```

- **Bật RLS cho cả 2 bảng.** Mỗi người chỉ đọc, ghi dữ liệu của chính mình:
  - `companies`: `user_id = auth.uid()` cho select/insert/update/delete.
  - `company_contacts`: chỉ khi `company_id` thuộc một công ty có `user_id = auth.uid()`.
- Trigger tự cập nhật `updated_at`.
- Lưu migration trong `supabase/migrations/` (dùng Supabase CLI), có file seed dữ liệu mẫu vài công ty ở TP.HCM để test.
- Sinh type TypeScript từ schema (`supabase gen types`) vào `src/types/database.ts`.
- Lưu công ty kèm danh sách liên hệ: thêm/sửa/xoá liên hệ cùng lúc khi bấm Lưu. Dùng một hàm Postgres (RPC) chạy trong transaction để không bị lưu dở dang.

## 8. Geocoding (địa chỉ → toạ độ)

Cần toạ độ cho điểm bắt đầu, điểm kết thúc và mọi công ty.

- Tạo interface chung `Geocoder` trong `src/lib/geocoding/` để sau này đổi nhà cung cấp dễ dàng.
- **MVP: dùng Nominatim (OpenStreetMap), miễn phí**, gọi qua route handler của Next.js (`/api/geocode`), không gọi thẳng từ trình duyệt:
  - Tuân thủ chính sách dùng của Nominatim: tối đa 1 request/giây, gửi `User-Agent` định danh app, có cache kết quả.
  - Giới hạn tìm trong Việt Nam (`countrycodes=vn`), ngôn ngữ `vi`.
  - Debounce ô nhập (≥ 500ms), tối thiểu 4 ký tự mới tìm.
- **Phương án dự phòng** (địa chỉ Việt Nam trên OSM đôi khi thiếu): cho phép người dùng **dán toạ độ** (`10.85, 106.77`) hoặc **dán link Google Maps** của địa điểm, app tự tách lat/lng ra.
- Sau khi chọn địa chỉ, hiện toạ độ nhỏ bên dưới để người dùng biết đã có vị trí.
- Ghi chú để sau: nếu cần chính xác hơn có thể đổi sang Google Places API (tốn phí, cần API key).

## 9. Lộ trình thực hiện

| Giai đoạn           | Nội dung                                                                                                | Xong khi                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **0. UI/UX**        | Hỏi câu hỏi mục 4, ghi `docs/design.md`, dựng 4 màn hình tĩnh                                           | Chủ dự án duyệt giao diện                          |
| **1. Khởi tạo**     | Next.js + TS + Tailwind + lint/format, kết nối Supabase, `.env.example`, copy logo vào `public/brand/`  | `npm run dev` chạy, trang trắng có logo            |
| **2. Đăng nhập**    | Google OAuth, callback, middleware, đăng xuất                                                           | Chưa đăng nhập thì không vào được trang nào        |
| **3. Công ty**      | Migration + RLS, danh sách, tạo, sửa, xoá, liên hệ nhiều dòng, geocoding                                | Tạo được công ty có toạ độ, có nhiều số điện thoại |
| **4. Tối ưu tuyến** | Module `route-optimizer` + test, trang chính, dialog chọn nhiều công ty, luồng tạo công ty rồi quay lại | Ra đúng thứ tự, test pass                          |
| **5. Google Maps**  | `buildGoogleMapsLinks` + test, nút mở, chia chặng khi nhiều điểm                                        | Bấm nút mở đúng tuyến trên điện thoại              |
| **6. Hoàn thiện**   | Trạng thái loading/lỗi/rỗng, kiểm tra trên điện thoại thật, deploy Vercel                               | Dùng được ngoài đường                              |

## 10. Cấu trúc thư mục gợi ý

```
src/
  app/
    login/page.tsx
    auth/callback/route.ts
    (app)/                 # nhóm route cần đăng nhập
      layout.tsx           # thanh tab dưới đáy
      page.tsx             # tối ưu tuyến
      companies/
        page.tsx
        new/page.tsx
        [id]/edit/page.tsx
    api/geocode/route.ts
  components/
  lib/
    supabase/              # client cho browser, server, middleware
    route-optimizer/       # thuần TS + tests
    google-maps/           # buildGoogleMapsLinks + tests
    geocoding/
    i18n/vi.ts
  types/database.ts
middleware.ts
supabase/migrations/
docs/design.md
```

## 11. Biến môi trường (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NOMINATIM_USER_AGENT=BeeRoute/0.1 (email-lien-he@example.com)
```

Cấu hình Google OAuth thực hiện trong Supabase Dashboard (Authentication → Providers → Google) và Google Cloud Console. Ghi các bước vào `README.md` để chủ dự án tự làm.

## 12. Chưa làm ở MVP (để sau)

- Đăng ký bằng email/mật khẩu.
- Nhiều người dùng chung một công ty (multi-tenant), phân quyền điều phối/tài xế.
- Lưu lịch sử các tuyến, thống kê, tính lương theo chuyến.
- Khoảng cách theo đường thật (OSRM/Google Directions), giờ mở cửa, khung giờ giao.
- Chế độ tối, PWA cài lên màn hình chính, dùng offline.
