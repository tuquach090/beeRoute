# BeeRoute — Database

Schema nằm ở `supabase/migrations/`. File này giải thích **vì sao** nó như vậy.

| Migration | Nội dung |
|---|---|
| `20261018000001_init.sql` | `profiles`, `companies`, `company_contacts` |
| `20261018000004_fix_contact_without_phone.sql` | định nghĩa hiện hành của RPC `save_company` |
| `20261025000001_trips.sql` | `trips`, `trip_stops`, `trip_stop_photos` + RPC `save_trip` |
| `20261025000002_delivery_photos_bucket.sql` | bucket Storage `delivery-photos` + policy |
| `20261116000001_optional_end_and_default_start.sql` | bỏ điểm kết thúc bắt buộc + điểm bắt đầu mặc định |

## Sáu bảng

```
auth.users  (Supabase quản lý)
    │
    ├─ 1:1 ─→ public.profiles          thông tin cơ bản lấy từ Google
    │
    ├─ 1:N ─→ public.companies         user_id = chủ sở hữu
    │              │
    │              └─ 1:N ─→ public.company_contacts
    │
    └─ 1:N ─→ public.trips             một chuyến = một tuyến đã tối ưu, có ngày
                   │
                   └─ 1:N ─→ public.trip_stops
                                  │
                                  └─ 1:N ─→ public.trip_stop_photos
```

Ba bảng đầu là danh mục — thứ người dùng khai báo một lần rồi dùng lại. Ba bảng
sau là lịch sử vận hành — sinh ra mỗi lần chạy xe. Hai nhóm này có luật phân
quyền **khác nhau**, xem mục [Chuyến](#chuyến-trips-trip_stops-trip_stop_photos).

### `profiles`

Supabase đã có sẵn `auth.users`, nhưng schema `auth` không nên truy vấn trực
tiếp từ app. `profiles` là bản sao của vài trường cần hiển thị:
`email`, `full_name`, `avatar_url`.

Dòng profile được tạo **tự động** bởi trigger `on_auth_user_created` chạy sau
khi Supabase chèn vào `auth.users`. App không phải tự insert.

Từ 16/11/2026 bảng này giữ thêm **tuỳ chọn của người dùng**:

```sql
default_start_label text
default_start_lat   double precision
default_start_lng   double precision
```

Đây là điểm xuất phát tự điền cho mọi tuyến mới — thường là kho lấy hàng. Nó nằm ở
`profiles` chứ không phải một bảng riêng vì nó là **một dòng cho một người**, và
`profiles` đã sẵn RLS chỉ-chủ-sở-hữu nên không phải viết policy mới.

Ràng buộc `profiles_default_start_complete` bắt ba cột phải đi cùng nhau. Thiếu toạ
độ thì cái nhãn không điền được vào đâu, nhưng nhìn vào màn Cài đặt vẫn tưởng đã lưu
xong — kiểu hỏng im lặng khó chịu nhất.

Trigger dùng `security definer` để bỏ qua RLS — lúc đó chưa có session nên
không chèn được bằng quyền thường.

Google trả metadata với tên trường không thống nhất, nên trigger thử lần lượt:
`full_name` rồi `name`, `avatar_url` rồi `picture`.

### `companies`

Giống đặc tả ở mục 7 CLAUDE.md, **cộng thêm một cột**:

```sql
is_public boolean not null default false
```

Tên là `is_public` chứ không phải `public` vì `public` cũng là tên schema trong
Postgres — viết `public` trần trong một policy đọc rất mơ hồ.

### `company_contacts`

Bảng con, `on delete cascade` theo `companies`. Xoá công ty là mất luôn liên hệ.
`sort_order` để giữ thứ tự các dòng liên hệ người dùng nhập.

## Cờ `is_public` công khai những gì

> **Quyết định của chủ dự án: công khai TẤT CẢ.**
>
> Khi `is_public = true`, mọi người dùng đã đăng nhập đọc được toàn bộ dòng
> công ty đó — **bao gồm số điện thoại liên hệ và ghi chú nội bộ**.

Tôi đã nêu rủi ro trước khi làm: ghi chú thường chứa thông tin riêng kiểu "gọi
anh Hùng trước 15 phút", "thủ tục vào cổng"; số điện thoại là dữ liệu cá nhân
của người thứ ba và công khai rồi thì khó thu hồi. Chủ dự án vẫn chọn phương án
này, nên đây là **hành vi cố ý, không phải lỗi**.

Muốn siết lại sau này thì sửa đúng hai chỗ:

1. Policy `companies_select_own_or_public` — bỏ `or is_public` nếu muốn tắt hẳn
   chia sẻ, hoặc tạo một view chỉ lộ `display_name, address, lat, lng`.
2. Policy `company_contacts_select_via_company` — bỏ `or c.is_public` để giữ
   riêng số điện thoại trong khi vẫn cho người khác thấy tên và địa chỉ.

## Chuyến (`trips`, `trip_stops`, `trip_stop_photos`)

Đặc tả đầu tiên ghi *"KHÔNG lưu kết quả tối ưu tuyến"*. Chủ dự án gỡ quy tắc đó
ngày 25/10/2026 để tra cứu được lịch sử và đính kèm ảnh chứng từ. Đảo một quy
tắc thì phải ghi lại, nên nó nằm ở đây thay vì âm thầm xuất hiện trong schema.

### `trips`

Một chuyến là một tuyến đã tối ưu, thuộc về một **ngày** và một **buổi**.

> **16/11/2026 — điểm kết thúc thành tuỳ chọn.** Form không hỏi nữa; chuyến kết thúc
> ở điểm giao cuối cùng. Ba cột `end_label` / `end_lat` / `end_lng` được cho phép
> NULL **chứ không bị xoá**: các chuyến ghi trước ngày đó thật sự có điểm kết thúc,
> và xoá cột là viết lại một dữ kiện đã đúng vào lúc nó được ghi. Ràng buộc
> `trips_end_all_or_nothing` giữ ba cột đi cùng nhau, vì một chuyến có nhãn mà thiếu
> toạ độ sẽ lặng lẽ mất điểm đến trong link Google Maps.
>
> `save_trip` **không được khai báo lại** ở migration đó. Ba tham số `p_end_*` chỉ
> cần nhận NULL, nên không sinh ra định nghĩa thứ hai cho cùng một hàm — bài học
> `save_company` ở quy tắc 3.8.

```sql
trip_date      date   not null                   -- không phải timestamptz
slot           text   check in ('morning','afternoon')
slot_position  int    not null default 0         -- 0 = chuyến chính, >0 = phụ
total_straight_km double precision
method         text   check in ('exact','heuristic')
```

Bốn cái tên ở trên đều là quyết định, không phải mặc định:

- **`trip_date` là `date`.** Postgres `now()` và `new Date()` trên Vercel đều
  chạy UTC; từ 0h đến 7h giờ Việt Nam chúng báo **hôm qua**. Một chuyến thuộc về
  ngày lịch ở UTC+7, không thuộc về một mốc thời gian. Mọi câu hỏi "hôm nay là
  ngày nào" đi qua `todayInVn()` trong `src/lib/dates/vn-date.ts` — đó là nơi duy
  nhất trong codebase dùng `Intl` cho múi giờ.
- **`slot_position`, không phải `position`.** `position` là tên hàm có sẵn của
  SQL (`position(x in y)`); đặt cột tên đó thì mọi truy vấn viết `position` trần
  đều mơ hồ. Giá trị do **server tự tính** (`coalesce(max(slot_position)+1, 0)`
  trong cùng `(user_id, trip_date, slot)`), không nhận từ client: chuyến đầu của
  buổi tự thành chính, các chuyến sau tự vào ô phụ.
- **`total_straight_km`, không phải `total_km`.** Mục 6.2 CLAUDE.md nhấn mạnh đây
  là khoảng cách **đường chim bay**, chỉ dùng để sắp thứ tự. Tên cột giữ luôn
  cảnh báo đó, kẻo người đọc sau hiểu thành quãng đường thật.
- **`method`** ghi lại thuật toán đã dùng (`exact` khi ≤ 8 điểm, `heuristic` khi
  nhiều hơn), để sau này đọc lại biết con số km đáng tin tới đâu.

### `trip_stops`

Điểm dừng **snapshot** `display_name`, `address`, `lat`, `lng` tại thời điểm chạy.

```sql
company_id uuid references companies(id) on delete set null
```

`set null` chứ không `cascade`: xoá một công ty **không** được làm mất điểm dừng
trong chuyến cũ. Snapshot vẫn đọc được tên và địa chỉ của hôm đó.

Nhưng **số điện thoại thì đọc sống** từ `companies`, không snapshot — tài xế đứng
ở cổng cần số của hôm nay, không phải số ba tháng trước. Xem `getTrip()` trong
`src/lib/trips/queries.ts`.

Ba cột dữ liệu giao hàng: `delivered_at timestamptz` (null = chưa giao),
`sample_taken boolean`, `note text`.

### `trip_stop_photos`

`storage_path` trỏ tới file trong bucket, `kind` phân loại
(`order` / `receipt` / `warehouse` / `sample`), `taken_at` ghi giờ.

Bảng này **chỉ giữ đường dẫn**. File nằm trong Storage, và khoá ngoại cascade chỉ
xoá **hàng trong DB** — xem mục [Storage](#storage--ảnh-chứng-từ).

### RPC `save_trip` — khác `save_company` một điểm sống còn

`save_company` **xoá sạch con rồi chèn lại**. Nếu `save_trip` làm vậy thì mỗi lần
tối ưu lại tuyến sẽ **xoá hết ảnh chứng từ** của chuyến đó.

Nên `save_trip` làm diff, không làm replace. Client gửi kèm `stop_id` của từng
điểm:

| `stop_id` client gửi | Hàm làm gì |
|---|---|
| có giá trị | `update` `sort_order` + `leg_km` + snapshot. **Không đụng** `delivered_at`, `sample_taken`, `note`, ảnh |
| `null` | `insert` điểm mới |
| điểm cũ không còn trong danh sách gửi lên | `delete` (cascade xoá hàng ảnh của nó) |

Hai chi tiết về thứ tự và cách khớp:

- Trong hàm, **`delete` chạy trước `insert`**. Ngược lại thì "điểm nào không còn
  trong danh sách" trở thành câu hỏi mơ hồ, vì điểm mới vừa chèn cũng chưa có
  trong mảng client gửi.
- Khớp bằng `stop_id` tường minh chứ không bằng `company_id`, vì `company_id` có
  thể null (công ty đã xoá) và về lý thuyết một tuyến ghé cùng một công ty hai
  lần vẫn hợp lệ.

`tripSchema` ở `src/lib/validation/trip.ts` **chặn `stop_id` trùng nhau**.
`update ... from` với hai dòng cùng id không báo lỗi — Postgres lặng lẽ chọn một
dòng bất kỳ, nên phải loại ở tầng validate.

> Ai sửa hàm này nhớ: bỏ phần giữ nguyên dữ liệu giao hàng = **xoá ảnh của người
> dùng**. Đây là ca kiểm thử thủ công số 6 trong kế hoạch, không có test tự động
> nào phủ được vì cần database thật.

Giữ nguyên mọi quy ước của `save_company`: `p_trip_id` null = tạo mới,
`returning ... into` rồi kiểm tra null để báo lỗi quyền, **không** `security
definer` (RLS vẫn áp dụng đủ), `revoke all from public, anon` +
`grant execute to authenticated`, thông báo lỗi tiếng Việt.

Và theo quy tắc 3.8 CLAUDE.md: hàm này **chỉ được khai báo ở đúng một migration**.

## Storage — ảnh chứng từ

Bucket `delivery-photos`, **private**.

Ảnh phiếu có tên khách hàng và chữ ký. Bucket public nghĩa là ai đoán được URL
đều xem được, không cần đăng nhập. Đọc ảnh bằng `createSignedUrl()` hạn 1 giờ.

Đường dẫn: `<user_id>/<trip_id>/<stop_id>/<uuid>.jpg`

**Segment đầu bắt buộc là `user_id`**, vì cả bốn policy trên `storage.objects`
phân quyền bằng `(storage.foldername(name))[1] = auth.uid()::text`. Đổi cấu trúc
đường dẫn thì upload hỏng với lỗi quyền không chỉ về đâu.

Bucket giới hạn 5MB/file và chỉ nhận `image/jpeg`, `image/png`, `image/webp`.
**HEIC bị loại có chủ ý**: iPhone chọn từ thư viện có thể trả HEIC, Safari hiển
thị được nhưng Chrome trên Android thì không — nhận vào là tạo ra ảnh vỡ trên
nửa số thiết bị. Thay vào đó `src/lib/images/compress.ts` báo lỗi rõ ràng.

Trình duyệt tải thẳng lên Supabase bằng anon key + session hiện tại, **không qua
server action** (nên không dính giới hạn body 1MB của Next) và **không cần
service-role key**.

Hai quy tắc bắt buộc, cả hai đều về file rác:

1. **Ghi hàng thất bại thì phải xoá file vừa tải lên.** Không thì file nằm lại
   vĩnh viễn trong hạn mức 1GB mà không có gì trỏ tới để tìm lại.
2. **Xoá chuyến/ảnh thì xoá file trước, xoá hàng sau.** Cascade của khoá ngoại
   chỉ xoá hàng trong DB; Postgres không biết gì về bucket.

Dung lượng: gói free cho 1GB. Nén về cạnh dài 1600px / JPEG 0.8 đưa ảnh 2.5MB
xuống ~300KB. Với 2 chuyến/ngày × 7 điểm × 2 ảnh thì khoảng 3,5 tháng mới đầy.
Nút duy nhất cần xoay nếu muốn gấp đôi thời gian đó: `MAX_EDGE_PX` 1600 → 1280.

## Row Level Security

RLS bật trên cả sáu bảng. Không có policy nào cho vai trò `anon` — chưa đăng nhập
là không đọc được gì.

| Bảng | Đọc | Ghi |
|---|---|---|
| `profiles` | dòng của chính mình | sửa dòng của chính mình; insert do trigger |
| `companies` | của mình **hoặc** `is_public = true` | chỉ chủ sở hữu |
| `company_contacts` | theo đúng quyền đọc của công ty cha | chỉ chủ sở hữu công ty cha |
| `trips` | **chỉ của mình** | chỉ của mình |
| `trip_stops` | theo quyền đọc chuyến cha | chỉ chủ sở hữu chuyến cha |
| `trip_stop_photos` | theo quyền đọc điểm dừng cha | chỉ chủ sở hữu điểm dừng cha |

### Chuyến không có nhánh `or is_public`

Ba bảng chuyến **chỉ chủ sở hữu đọc được**, không có ngoại lệ nào. Đây là điểm
khác `companies` một cách cố ý:

> Công ty có thể công khai, nhưng việc bạn ghé đó sáng thứ Ba thì không.

Danh mục công ty là thứ chia sẻ được — tên, địa chỉ, số điện thoại của một nơi
nhận hàng. Lịch sử chuyến là **dấu vết di chuyển của một người cụ thể**, cộng với
ảnh chứng từ có tên khách và chữ ký. Hai loại dữ liệu này không chung một luật
được, nên đừng copy policy của `companies` sang đây.

Hai điểm đáng chú ý trong policy ghi:

- `companies_insert_own` có `with check (user_id = auth.uid())`. Không có dòng
  này thì client gửi lên một row gắn `user_id` của người khác vẫn lọt.
- Policy của `company_contacts` kiểm tra quyền qua `exists (select 1 from
  companies …)`. Người khác **không** chèn được liên hệ vào công ty public của
  bạn — đọc được không có nghĩa là ghi được.

## Index

| Index | Phục vụ |
|---|---|
| `companies_user_id_idx` | danh sách công ty của một người |
| `companies_is_public_idx` | tìm công ty người khác chia sẻ (partial, chỉ index dòng `is_public = true`) |
| `company_contacts_company_id_idx` | lấy liên hệ theo công ty, đã sắp theo `sort_order` |
| `trips_user_date_idx` | `(user_id, trip_date)` — phục vụ cả lưới lịch tháng lẫn một ngày |
| `trip_stops_trip_id_idx` | lấy điểm dừng theo chuyến, đã sắp theo `sort_order` |
| `trip_stop_photos_stop_id_idx` | lấy ảnh theo điểm dừng |

Truy vấn tháng **không bao giờ `order by slot`**: xếp chữ thì `'afternoon'` đứng
trước `'morning'`, tức là buổi chiều lên trước buổi sáng. Thứ tự buổi do code sắp,
xem `listTripsForMonth()`.

## `updated_at`

Hàm `set_updated_at()` dùng chung, gắn trigger `before update` cho `profiles`,
`companies`, `trips` và `trip_stops`. App không cần tự set.

`company_contacts` không có `updated_at` — đúng theo đặc tả mục 7.
`trip_stop_photos` cũng không: một ảnh đã tải lên thì không sửa, chỉ xoá.

## TypeScript types

`src/types/database.ts` đang **viết tay** cho khớp migration. Khi project
Supabase đã có, thay bằng bản sinh tự động:

```bash
npx supabase gen types typescript --project-id <project-ref> > src/types/database.ts
```

Sửa migration thì nhớ sinh lại, nếu không type sẽ nói dối.

## Chưa làm

- **Seed dữ liệu mẫu** (mục 7 CLAUDE.md) — chưa có, vì seed cần `user_id` thật
  mà id đó chỉ tồn tại sau lần đăng nhập đầu tiên.
- **Dọn file rác trong Storage.** Mọi đường xoá hiện tại đều xoá file trước rồi
  mới xoá hàng, nhưng nếu bước xoá file hỏng thì file ở lại vĩnh viễn và chưa có
  công cụ nào rà soát bucket để tìm file không còn ai trỏ tới.
- **Thống kê theo tuần/tháng** (đếm chuyến, tổng km, tính lương) — dữ liệu đã
  đủ trong `trips`, chỉ còn thiếu màn hình.
- **Giao diện tìm công ty `is_public` của người khác** — cờ và policy đã có từ
  đầu, chưa có chỗ nào trong app dùng tới.

(Hai mục cũ — RPC `save_company` và migration transaction — đã xong, xem
`20261018000004_fix_contact_without_phone.sql`.)
