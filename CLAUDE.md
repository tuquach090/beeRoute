# CLAUDE.md – BeeRoute (MVP)

> File này hướng dẫn Claude Code xây dựng BeeRoute. Đọc hết trước khi viết dòng code đầu tiên.
> Ngôn ngữ giao tiếp với chủ dự án: **tiếng Việt**, xưng hô thân mật, ngắn gọn.
>
> Cập nhật 18/10/2026, sau khi xong Giai đoạn 0–5. Các mục mô tả **hiện trạng**, không
> phải dự định. Chỗ nào code khác file này thì code đúng — sửa file này lại.

---

## 1. Bối cảnh

- **BeeRoute** là ứng dụng web giúp người giao hàng **sắp xếp thứ tự các điểm giao theo kiểu gần trước, xa sau** (mục 6.2), rồi mở tuyến đã sắp trên Google Maps để chạy.
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
Dùng cả Auth, Postgres và **Storage** (ảnh chứng từ giao hàng).

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
3. Kết quả tối ưu **được** lưu vào database dưới dạng **chuyến** (mục 7). Quy tắc cũ
   cấm việc này; chủ dự án đã gỡ ngày 25/10/2026. Vẫn giữ nguyên tinh thần ban đầu:
   không tự ý thêm bảng mới khi chưa hỏi.
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

Có đặt **điểm bắt đầu mặc định** trong Cài đặt (mục 5.4) thì ô này **tự điền sẵn**
chỗ đó khi mở trang. Đổi sang cái khác vẫn được, và có nút "Dùng điểm mặc định" để
quay lại bằng một lần bấm.

Việc tự điền chỉ chạy **một lần cho mỗi bản nháp**, đánh dấu bằng cờ `startSeeded`
trong `route-draft.ts`. Không có cờ đó thì không phân biệt được "chưa đụng vào form"
với "đã cố ý đổi sang Vị trí hiện tại", và điểm mặc định sẽ nhảy lại mỗi lần
chuyển trang.

**b) Các điểm đến** (bắt buộc ít nhất 1):
- Nút **"+ Thêm điểm đến"** → màn hình chọn công ty **toàn màn hình, ô tìm nằm trên cùng** (để bàn phím không che), tìm như ở danh sách công ty (mục 5.3),
  chọn nhiều bằng checkbox, bấm "Xong". Huỷ thì không áp dụng gì.
- Chưa có công ty nào hoặc không tìm thấy → nút **"Tạo công ty mới"** →
  `/companies/new?returnTo=/`.
- Tạo xong quay lại thì **giữ nguyên lựa chọn cũ** và **tự chọn sẵn công ty vừa tạo**
  (`?added=<id>`). Trạng thái form nằm trong `sessionStorage`, quản lý ở
  `src/lib/route-draft.ts`.

**c) Phương tiện**: xe máy / ô tô.

**d) Nút "Tối ưu tuyến"** → chạy module mục 6 **ngay trên trình duyệt**, không gọi server.

**e) Kết quả** hiện ngay trên trang: thứ tự đã tối ưu, khoảng cách từng chặng, tổng km
(ghi rõ là đường chim bay), số điện thoại bấm gọi được (`tel:`), ghi chú của công ty,
và nút **"Mở trên Google Maps"**.

> **Không còn ô "Điểm kết thúc"** (gỡ 16/11/2026). Chuyến kết thúc ở điểm giao cuối
> cùng. Ép thêm một chặng về kho là cộng vào tổng km một đoạn đường không ai chạy.
> Các chuyến lưu trước ngày đó vẫn giữ điểm kết thúc của chúng — ba cột `end_*` chỉ
> được cho phép NULL chứ không bị xoá.

### 5.3 Quản lý công ty — ĐÃ LÀM

**Danh sách** `/companies` · **Tạo** `/companies/new` · **Sửa** `/companies/[id]/edit`

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| Tên hiển thị | ✅ | Tối đa 120 ký tự. **Không trùng** với công ty khác của mình |
| Địa chỉ | ✅ | **Bắt buộc có toạ độ** mới lưu được (xem mục 8) |
| Liên hệ | ❌ | Nhiều dòng. Mỗi dòng: tên người/phòng ban + số điện thoại |
| Ghi chú | ❌ | Việc cần làm khi tới nơi |
| Mã vào cổng | ❌ | **Một ảnh** (QR, thẻ, bảng hướng dẫn). Chụp hoặc chọn từ thư viện, đổi, xoá được |
| Cho người khác tìm thấy | ❌ | Cờ `is_public`, mặc định tắt (xem mục 7) |

- **Tìm kiếm** ở đầu danh sách (dính dưới thanh đầu trang khi cuộn): tìm theo tên,
  địa chỉ, tên người liên hệ, số điện thoại; **không cần gõ dấu** ("dai hoa" ra
  "Đại Hoa"); mọi từ phải có mặt nhưng không cần đúng thứ tự. Bảng chọn công ty ở
  trang tối ưu dùng chung logic này (`src/lib/companies/match.ts`).
- **Tên trùng bị chặn** (thêm 20/11/2026), cả khi tạo lẫn khi đổi tên: lỗi hiện dưới
  ô tên, kèm link mở công ty trùng. So không phân biệt hoa thường và khoảng trắng
  thừa, nhưng **có phân biệt dấu** ("Hoà" khác "Hoa"). Chỉ so với công ty của chính
  mình. Kiểm tra trong server action, **không có unique index**: dữ liệu cũ có thể
  đã trùng sẵn (chính vì vậy mới có chức năng gộp) và index sẽ không tạo được. Gộp
  hết công ty trùng rồi thì có thể thêm index sau.
- **Một dòng liên hệ chỉ cần có tên HOẶC có số** — cả hai đều không bắt buộc. Dòng trống
  cả hai thì bị bỏ khi lưu, không tạo bản ghi rác.
- Số điện thoại có nhập thì phải đúng định dạng VN: 10–11 số bắt đầu bằng `0`, hoặc `+84`.
  Chấp nhận dấu cách, gạch, ngoặc — sẽ được chuẩn hoá trước khi lưu.
- Lưu xong: có `returnTo` thì quay về đó kèm `?added=<id>`, không thì về `/companies`.
- Xoá công ty: có hộp xác nhận. Xoá luôn file ảnh mã vào cổng.
- **Ảnh mã vào cổng chỉ được tải lên lúc bấm Lưu**, không phải lúc chọn ảnh — chọn
  rồi bỏ ngang thì không có file rác. Lưu hỏng thì trình duyệt xoá file vừa tải.

**Gộp công ty trùng** (thêm 20/11/2026): ở `/companies` bấm "Gộp công ty trùng", tick
từ 2 công ty trở lên, rồi chọn công ty **giữ lại**. Các công ty còn lại bị xoá; số
liên hệ (bỏ số trùng), ghi chú (nối vào cuối), ảnh mã vào cổng (công ty giữ lại
không có ảnh thì lấy ảnh của công ty được tick đầu tiên) và **toàn bộ chuyến cũ**
chuyển sang công ty giữ lại. Chuyến cũ **đổi luôn tên/địa chỉ/toạ độ** sang công ty
giữ lại — chủ dự án chọn vậy, vì gộp nghĩa là chúng vốn là một công ty. Chi tiết ở
mục 7.

Ở trang xem chuyến, **bấm tên công ty** mở hộp thông tin: địa chỉ, ảnh mã vào cổng,
số liên hệ, ghi chú — đọc sống từ `companies`, không phải snapshot.

### 5.4 Cài đặt — ĐÃ LÀM

`/settings`, vào bằng menu avatar ở góc trên phải (không chiếm chỗ thanh tab dưới đáy).

| Thiết lập | Ghi chú |
|---|---|
| Điểm bắt đầu mặc định | Dán link Google Maps như mọi chỗ khác (mục 8). Để trống = hỏi lại mỗi lần |

Lưu vào ba cột trên `profiles`, không phải bảng mới: đây là tuỳ chọn của một người,
và `profiles` đã có sẵn RLS chỉ-chủ-sở-hữu.

**Nhãn và toạ độ phải đi cùng nhau** — có cái này thiếu cái kia thì điểm mặc định
không điền được vào đâu mà trông vẫn như đã lưu. Ràng buộc nằm ở cả `check` trong
database lẫn `.refine` trong `src/lib/validation/settings.ts`.

### 5.5 Lịch chuyến (`/trips`) — ĐÃ LÀM

Lưới tháng, chọn một ngày thì hiện khung **Sáng** và **Chiều**, mỗi khung một chuyến
chính và các chuyến phụ.

**Dưới mỗi ngày** (thêm 20/11/2026): hai vạch Sáng/Chiều — **xanh** = có chuyến,
**tím và dày hơn** = đi tỉnh xa — cộng **chấm vàng mật** nếu hôm đó có lấy mẫu. Có chú
thích màu dưới lịch, và mỗi ô có `aria-label` đọc thành lời. Ngày đang chọn dùng
nền nhạt + viền xanh chứ không tô đặc, để màu các vạch không bị nuốt.

**Thẻ chuyến** hiện: số điểm, km, tên các điểm theo thứ tự, nhãn **Tỉnh xa**, nhãn
**Có mẫu** (kèm số điểm lấy mẫu), và **Đã giao x/y**.

**Tỉnh xa = đúng 1 điểm và `total_straight_km` > 60** (`FAR_TRIP_MIN_KM` trong
`src/lib/trips/classify.ts`) — luật của chủ dự án. Dùng đúng con số chim bay đang
hiện trong app để nhãn khớp với số ghi bên cạnh; 60km chim bay ≈ 75–80km đường thật.
Tính lúc đọc, không lưu cột nào.

Màu tím là token `--far` / `--far-foreground` mới (`#6D28D9` sáng, `#A78BFA` tối), đã
thêm vào `npm run check:contrast`. Chấm vàng mật chỉ đạt 1.6:1 trên nền trắng nên
**phải giữ viền đen than** (`ring-foreground`).

## 6. Module tối ưu tuyến — ĐÃ LÀM

`src/lib/route-optimizer/`. **Thuần TypeScript**, không phụ thuộc React, Next.js hay
Supabase. Test ở `optimize.test.ts`.

### 6.1 Giao diện hàm

```ts
type LatLng = { lat: number; lng: number };
type Stop = { id: string; label: string; location: LatLng };

// end là tuỳ chọn. Tuyến mới không có; chuyến lưu trước 16/11/2026 thì có.
type OptimizeInput = { start: LatLng; stops: Stop[]; end?: LatLng | null };

type OptimizeResult = {
  orderedStops: Stop[];
  // start→stop1, … Có end thì dài orderedStops.length + 1, không có thì = length.
  legsKm: number[];
  totalKm: number;     // haversine, đường chim bay
  method: "heuristic"; // luôn vậy; chuyến lưu trước 20/11/2026 có thể ghi "exact"
};

export function optimizeRoute(input: OptimizeInput): OptimizeResult;
```

### 6.2 Thuật toán — gần nhất trước (đổi 20/11/2026)

**Nearest Neighbor thuần**, theo đúng yêu cầu của chủ dự án:

1. Từ điểm xuất phát, đi tới điểm giao **gần điểm xuất phát nhất**.
2. Từ đó, đi tới điểm **gần điểm vừa giao nhất** trong số còn lại. Lặp tới hết.

Ví dụ: kho → A (5km) → C (8km tính từ A) → B (2km tính từ C).

- Khoảng cách **Haversine** (km, bán kính 6371), ma trận tính sẵn một lần.
- Hai điểm cách đều nhau thì **điểm đứng trước trong danh sách** được chọn — kết quả
  luôn lặp lại được.
- Có điểm kết thúc (chỉ chuyến cũ) thì nó **chỉ thêm một chặng cuối**, không kéo thứ
  tự về phía nó.
- **Không** duyệt hoán vị, **không** 2-opt, **không** luật bên phải. Cả ba đã có và đã
  bị gỡ: chúng cho ra thứ tự ngắn hơn trên giấy (chạy thẳng tới điểm xa nhất rồi
  giao ngược về, bên trái đường) nhưng không phải cách người chạy thật đi. Mỗi bước
  chỉ nhìn một chặng tới chính là thứ làm kết quả **đoán trước được từ yên xe**.
  Đừng "cải tiến" thêm bước tối ưu khi chưa hỏi.
- Không giới hạn số điểm — 25 điểm vẫn chạy tức thì.
- Luôn ghi rõ trong code và trên giao diện: đây là **khoảng cách đường chim bay**, chỉ
  dùng để sắp thứ tự. Đường đi thật do Google Maps tính.

Test có ví dụ của chủ dự án và 6 điểm thật ở Bình Dương (`optimize.test.ts`).

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

Điểm đầu luôn gửi toạ độ — nó đến từ GPS hoặc người dùng gõ, không có bản ghi công ty
nào đứng sau. Từ 16/11/2026 không còn điểm kết thúc riêng, nên **`destination` của link
chính là điểm giao cuối cùng** — đó là một công ty có địa chỉ thật, nên nó được gửi
dạng chữ và hiện tên đàng hoàng trên Maps.

Toạ độ làm tròn 6 chữ số (~11cm) để URL không dính nhiễu dấu phẩy động.

**Giới hạn waypoint**: `MAX_WAYPOINTS_PER_LINK = 8`. Vượt thì chia nhiều chặng, điểm cuối
chặng trước là điểm đầu chặng sau, hiện nhiều nút "Mở chặng 1", "Mở chặng 2"…

## 7. Dữ liệu (Supabase)

Sáu bảng: `profiles`, `companies`, `company_contacts`, và từ 25/10/2026 thêm
`trips`, `trip_stops`, `trip_stop_photos`.

> **Thay đổi so với bản đặc tả đầu:** trước đây mục này ghi *"KHÔNG lưu kết quả tối ưu
> tuyến"*. Chủ dự án đã gỡ để tra cứu được lịch sử và đính kèm ảnh chứng từ.

Schema đầy đủ: `supabase/migrations/`. Giải thích lý do: **[docs/database.md](docs/database.md)**.

### Danh mục (`profiles`, `companies`, `company_contacts`)

`profiles` giữ thông tin cơ bản lấy từ Google, tạo tự động bằng trigger khi đăng nhập
lần đầu, cộng thêm **`default_start_label` / `default_start_lat` / `default_start_lng`**
(thêm 16/11/2026, mục 5.4). Ba cột này là "tất cả hoặc không cái nào", ép bằng
`check` chứ không chỉ tin vào form.

Khác với bản đặc tả ban đầu:

- `companies` có thêm cột **`is_public boolean not null default false`**.
  Đặt tên `is_public` chứ không phải `public` vì `public` cũng là tên schema trong Postgres.
- `company_contacts.phone` **cho phép NULL** (mục 5.3).
- `companies.gate_photo_path text` (thêm 20/11/2026): đường dẫn ảnh mã vào cổng trong
  bucket, **không phải URL**. Một cột chứ không phải bảng: chủ dự án chốt mỗi công ty
  một ảnh, và không muốn thêm bảng. Check `companies_gate_photo_in_own_folder` bắt
  segment đầu phải là `user_id`.

### `is_public` công khai những gì

> **Quyết định của chủ dự án: công khai TẤT CẢ.** `is_public = true` thì mọi người dùng đã
> đăng nhập đọc được toàn bộ công ty đó, **kể cả số điện thoại và ghi chú nội bộ**.

Rủi ro đã được nêu trước khi làm và chủ dự án vẫn chọn phương án này. Đây là **hành vi cố
ý, không phải lỗi**. Muốn siết lại thì sửa đúng hai policy, xem `docs/database.md`.

**Ngoại lệ: ảnh mã vào cổng không đi theo `is_public`.** Người khác đọc được cột
`gate_photo_path` nhưng không mở được file — policy của bucket chỉ cho chủ thư mục.
Khi làm màn hình tìm công ty công khai thì phải quyết lại chỗ này.

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

### Gộp công ty — RPC `merge_companies`

Migration `20261120000001`. Một transaction: chuyển liên hệ, ghi chú, ảnh, **sửa
`trip_stops`** (trỏ về công ty giữ lại và ghi đè snapshot tên/địa chỉ/toạ độ), rồi xoá
các công ty bị gộp. Không `security definer`; kiểm tra chủ sở hữu **tường minh** vì RLS
cho đọc cả công ty `is_public` của người khác.

Đây là **chỗ duy nhất được phép ghi đè snapshot** của `trip_stops`. Chuyến của
*người khác* từng ghé công ty bị gộp (công ty đó `is_public`) không bị sửa — RLS chặn
— và chỉ mất `company_id` như khi xoá thường.

Hàm trả về các đường dẫn ảnh không còn ai trỏ tới; server action xoá file **sau khi**
transaction xong. Ngược với quy tắc "xoá file trước" ở dưới, có chủ ý: gộp hỏng giữa
chừng thì không được mất ảnh mà công ty vẫn đang hiện.

### Chuyến (`trips`, `trip_stops`, `trip_stop_photos`)

Migration `20261025000001_trips.sql`, sửa thêm ở `20261116000001`. **Chỉ chủ sở hữu đọc được — không có nhánh
`or is_public` ở đâu cả.** Công ty có thể công khai, nhưng việc bạn ghé đó sáng thứ Ba
thì không.

Ba chi tiết cố ý:

- **`trip_date` là `date`, không phải `timestamptz`.** Postgres `now()` và `new Date()`
  trên Vercel đều chạy UTC; từ 0h đến 7h giờ Việt Nam chúng báo **hôm qua**. Mọi câu
  hỏi "hôm nay là ngày nào" đi qua `todayInVn()` trong `src/lib/dates/vn-date.ts`, đó là
  nơi duy nhất trong codebase dùng `Intl` cho múi giờ.
- **`total_straight_km`**, không phải `total_km` — giữ cảnh báo của mục 6.2 ngay trong
  tên cột, kẻo người sau đọc nhầm thành quãng đường thật.
- **`trip_stops` snapshot** tên/địa chỉ/toạ độ. `company_id` là `on delete set null`, nên
  xoá công ty không làm mất điểm trong chuyến cũ. Nhưng **số điện thoại đọc sống** từ
  `companies` — tài xế đứng ở cổng cần số của hôm nay, không phải số ba tháng trước.
- **`end_label` / `end_lat` / `end_lng` cho phép NULL** từ 16/11/2026. Form không hỏi
  điểm kết thúc nữa (mục 5.2). Ba cột được **nới lỏng chứ không xoá**: chuyến cũ có
  điểm kết thúc thật, xoá cột là viết lại lịch sử đã đúng lúc nó được ghi. Có ràng
  buộc `trips_end_all_or_nothing` để không ra được chuyến có nhãn mà thiếu toạ độ.

`save_trip` **không được khai báo lại** ở migration `20261116000001`: ba tham số
`p_end_*` của nó giờ nhận NULL là xong, nên không sinh ra định nghĩa thứ hai cho một
hàm (quy tắc 3.8).

### RPC `save_trip` — khác `save_company` một điểm sống còn

`save_company` xoá sạch con rồi chèn lại. **`save_trip` không được làm vậy**: tối ưu lại
tuyến sẽ xoá sạch ảnh chứng từ.

Client gửi kèm `stop_id` của từng điểm (null = điểm mới). Hàm cập nhật điểm cũ tại chỗ,
**không đụng** `delivered_at`, `sample_taken`, `note` và ảnh; xoá điểm không còn trong
danh sách; chèn điểm mới. Thứ tự trong hàm là xoá **trước** rồi mới chèn, để "điểm nào
không còn" là câu hỏi không mơ hồ.

Ai sửa hàm này nhớ: bỏ phần giữ nguyên dữ liệu giao hàng = xoá ảnh của người dùng.

### Storage — ảnh chứng từ

Bucket `delivery-photos`, **private**. Ảnh phiếu có tên khách và chữ ký; bucket public
nghĩa là ai đoán được URL đều xem được. Đọc bằng signed URL hạn 1 giờ.

Đường dẫn `<user_id>/<trip_id>/<stop_id>/<uuid>.jpg`, và ảnh mã vào cổng ở
`<user_id>/companies/<uuid>.jpg` (cùng bucket) — **segment đầu bắt buộc là
`user_id`**, vì mọi policy phân quyền bằng `(storage.foldername(name))[1] = auth.uid()`.
Đổi cấu trúc này thì upload hỏng với lỗi quyền không chỉ về đâu.

Trình duyệt tải thẳng lên Supabase bằng anon key, **không qua server action** (nên không
dính giới hạn body 1MB của Next) và **không cần service-role key**.

Hai quy tắc bắt buộc:

- **Ghi hàng thất bại thì phải xoá file vừa tải lên.** Không thì file nằm lại vĩnh viễn
  trong hạn mức 1GB mà không gì trỏ tới.
- **Xoá chuyến/ảnh thì xoá file trước, xoá hàng sau.** Cascade chỉ xoá hàng trong DB.
  Hai ngoại lệ có lý do: **đổi** ảnh mã vào cổng (ghi hàng trước, xoá file cũ sau) và
  **gộp công ty** (như trên) — ở cả hai, làm ngược lại thì một lần ghi hỏng sẽ để
  công ty trỏ vào một file đã mất.

Nếu sau này có route của Next phục vụ ảnh, **đường dẫn không được kết thúc bằng đuôi
ảnh** — matcher trong `middleware.ts` loại trừ chúng, route sẽ lọt qua tầng xác thực.

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
| **6. Hoàn thiện** | Trạng thái loading/lỗi/rỗng, kiểm tra trên điện thoại thật | ✅ xong |
| **7. Chuyến** | Lưu chuyến, lịch tra cứu, ảnh chứng từ, lấy mẫu, đã giao | ✅ xong |
| **8. Cài đặt + luật bên phải** | Bỏ điểm kết thúc, điểm bắt đầu mặc định, tối ưu theo hành lang | ✅ xong; luật bên phải gỡ ở GĐ 9 |
| **9. Mã cổng + gộp + core mới** | Ảnh mã vào cổng, gộp công ty trùng, hộp thông tin công ty, core gần nhất trước, tìm công ty, lịch có mẫu/tỉnh xa | ⏳ đang làm |

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
      trips/page.tsx                lịch tháng
      trips/[id]/page.tsx           xem chuyến + ảnh
      trips/[id]/edit/page.tsx      sửa tuyến, dùng lại RouteForm
      settings/page.tsx             điểm bắt đầu mặc định
  components/
    ui/                             shadcn, không sửa tay
    route-form.tsx  company-form.tsx  company-picker-sheet.tsx
    company-list.tsx                danh sách + chế độ gộp
    gate-photo-field.tsx            ảnh mã vào cổng trong form công ty
    settings-form.tsx
    address-input.tsx  account-menu.tsx  bottom-tabs.tsx
    logo.tsx  theme-script.tsx  theme-toggle.tsx  google-*.tsx
  lib/
    supabase/                       client / server / middleware / env
    companies/                      queries.ts (đọc) + actions.ts (ghi, gộp) + storage.ts (đường dẫn ảnh mã cổng)
                                    + match.ts (tìm không dấu, chặn tên trùng), có test
    trips/                          queries/actions + storage.ts (đường dẫn ảnh) + classify.ts (tỉnh xa, có test)
    settings/                       queries/actions + types.ts (điểm bắt đầu mặc định)
    dates/vn-date.ts                múi giờ VN + lưới lịch, có test
    images/compress.ts              nén ảnh bằng canvas, có test
    route-optimizer/                thuần TS + test (gần nhất trước)
    google-maps/                    build-links + test
    geocoding/                      parse-location + test (regex, không gọi mạng)
    validation/                     zod schema + resolver tự viết + test
    i18n/vi.ts                      toàn bộ chữ tiếng Việt
    route-draft.ts                  sessionStorage store, tách ngăn theo chuyến
    use-current-location.ts         Geolocation API
    use-visual-viewport.ts          phần màn hình bàn phím không che
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
- Thống kê/biểu đồ theo tuần tháng, tính lương theo chuyến (lịch sử chuyến đã có).
- Khoảng cách theo đường thật, giờ mở cửa, khung giờ giao. Đã thử OSRM và Valhalla
  (16/11/2026) với 6 điểm thật: cả hai đều không xếp ra thứ tự chủ dự án chạy, kể cả
  khi ép ghé đúng lề phải, vì không tính thời gian chờ đèn để băng qua đường lớn.
- Giao đúng bên phải trên đường lớn (TL743B). Cách duy nhất đã test ra đúng là đánh
  dấu tay "xe chạy trước cổng đi hướng nào" cho từng công ty; chủ dự án để sau.
- Nhiều điểm bắt đầu mặc định (kho sáng khác kho chiều) — hiện chỉ có một.
- Seed dữ liệu mẫu (cần `user_id` thật nên phải có người đăng nhập trước).
- PWA cài lên màn hình chính, dùng offline.
- Bộ đếm ký tự cho ô "Tên hiển thị".
- Dọn ảnh rác trong Storage: khoá ngoại cascade xoá **hàng trong DB**, không xoá file.
  Các đường xoá hiện tại đều xoá file trước rồi mới xoá hàng, nhưng nếu bước xoá file
  hỏng thì file ở lại vĩnh viễn và chưa có công cụ rà soát.
- Chuyển chuyến phụ thành chuyến chính.
- Kéo thả đổi thứ tự điểm bằng tay.
- Hàng đợi tải ảnh khi mất mạng.
