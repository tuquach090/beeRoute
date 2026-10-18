# BeeRoute — Database

Schema nằm ở `supabase/migrations/20261018000001_init.sql`. File này giải thích
**vì sao** nó như vậy.

## Ba bảng

```
auth.users  (Supabase quản lý)
    │
    ├─ 1:1 ─→ public.profiles          thông tin cơ bản lấy từ Google
    │
    └─ 1:N ─→ public.companies         user_id = chủ sở hữu
                   │
                   └─ 1:N ─→ public.company_contacts
```

### `profiles`

Supabase đã có sẵn `auth.users`, nhưng schema `auth` không nên truy vấn trực
tiếp từ app. `profiles` là bản sao của vài trường cần hiển thị:
`email`, `full_name`, `avatar_url`.

Dòng profile được tạo **tự động** bởi trigger `on_auth_user_created` chạy sau
khi Supabase chèn vào `auth.users`. App không phải tự insert.

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

## Row Level Security

RLS bật trên cả ba bảng. Không có policy nào cho vai trò `anon` — chưa đăng nhập
là không đọc được gì.

| Bảng | Đọc | Ghi |
|---|---|---|
| `profiles` | dòng của chính mình | sửa dòng của chính mình; insert do trigger |
| `companies` | của mình **hoặc** `is_public = true` | chỉ chủ sở hữu |
| `company_contacts` | theo đúng quyền đọc của công ty cha | chỉ chủ sở hữu công ty cha |

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

## `updated_at`

Hàm `set_updated_at()` dùng chung, gắn trigger `before update` cho `profiles` và
`companies`. App không cần tự set.

`company_contacts` không có `updated_at` — đúng theo đặc tả mục 7.

## TypeScript types

`src/types/database.ts` đang **viết tay** cho khớp migration. Khi project
Supabase đã có, thay bằng bản sinh tự động:

```bash
npx supabase gen types typescript --project-id <project-ref> > src/types/database.ts
```

Sửa migration thì nhớ sinh lại, nếu không type sẽ nói dối.

## Chưa làm

- **Seed dữ liệu mẫu** (mục 7 CLAUDE.md) — chưa có, vì seed cần `user_id` thật
  mà id đó chỉ tồn tại sau lần đăng nhập đầu tiên. Làm ở Giai đoạn 3.
- **RPC lưu công ty kèm liên hệ trong một transaction** (mục 7) — Giai đoạn 3.
