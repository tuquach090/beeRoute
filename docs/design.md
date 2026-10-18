# BeeRoute — Quyết định thiết kế (Giai đoạn 0)

Chốt ngày 17/10/2026. File này ghi lại câu trả lời của chủ dự án cho mục 4 của
`CLAUDE.md`, và những quy ước rút ra từ đó. Sửa thiết kế thì sửa file này trước.

## 1. Tám câu hỏi đã chốt

| #   | Câu hỏi                 | Đã chốt                                                                     | Khác gợi ý mặc định?                       |
| --- | ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Ưu tiên thiết bị        | **Mobile-first**, màn hình chính nhắm 390px; desktop chỉ cần không vỡ       | không                                      |
| 2   | Phong cách              | **(a) pha (b)** — thẻ bo góc lớn, viền rõ, màu thương hiệu mạnh, bố cục gọn | không                                      |
| 3   | Sáng / tối              | **Làm cả hai ngay**, có nút đổi ở thanh đầu trang                           | **có** — mặc định chỉ gợi ý làm sáng trước |
| 4   | Font                    | **Be Vietnam Pro**, số dùng tabular                                         | không                                      |
| 5   | Điều hướng              | **Thanh tab dưới đáy**, 2 mục: Tuyến đường / Công ty                        | không                                      |
| 6   | Bản đồ trong app        | **Chưa làm ở MVP**                                                          | không                                      |
| 7   | Nút hành động chính     | **Cố định dưới đáy**, cao ≥ 52px, nằm ngay trên thanh tab                   | không                                      |
| 8   | Phương tiện Google Maps | **Xe máy** (`two-wheeler`), đổi được sang ô tô                              | không                                      |

Ngoài ra, mục 2 của `CLAUDE.md` ghi "thư viện component chốt ở Giai đoạn 0":

| Quyết định         | Đã chốt                                                     |
| ------------------ | ----------------------------------------------------------- |
| Thư viện component | **shadcn/ui** (preset `radix-nova`, biến thể CSS variables) |

## 2. Hệ quả của quyết định "làm cả sáng và tối ngay"

Câu 3 lệch so với gợi ý mặc định, và cũng lệch so với mục 12 của `CLAUDE.md`
(chế độ tối nằm trong danh sách "chưa làm ở MVP"). Hai chỗ đó cần thống nhất lại:
**mục 12 nên bỏ dòng "Chế độ tối"**.

Cách làm đã chọn:

- `.dark` đặt trên thẻ `<html>`, theo đúng quy ước của shadcn/ui.
- `src/components/theme-script.tsx` chạy **trước khi vẽ khung hình đầu tiên**, đọc
  `localStorage["beeroute-theme"]`; chưa có thì theo thiết lập hệ điều hành. Nhờ vậy
  mở app ở chế độ tối không bị loé sáng một nhịp.
- `src/components/theme-toggle.tsx` đọc trạng thái **từ chính class trên `<html>`**
  qua `useSyncExternalStore`, không giữ bản sao state riêng — nên nút luôn khớp
  với giao diện kể cả khi có thứ khác đổi theme.
- Component **không dùng tiền tố `dark:`**. Tất cả đi qua token ngữ nghĩa
  (`bg-card`, `text-muted-foreground`…), nên chỉ cần định nghĩa màu hai lần ở
  `globals.css` là xong, không phải sửa từng component.

## 3. Bảng màu

Hằng số thương hiệu, giống nhau ở cả hai chế độ:

| Token         | Mã        | Dùng cho                           |
| ------------- | --------- | ---------------------------------- |
| `brand`       | `#2F5BEA` | Màu chính, nút chính               |
| `brand-light` | `#7D9BFF` | Chữ xanh trên nền tối              |
| `honey`       | `#FFC21A` | Điểm nhấn, huy hiệu đếm số         |
| `ink`         | `#1C1A17` | Chữ trên nền sáng và trên nền vàng |

Token ngữ nghĩa (đổi theo chế độ) nằm ở `src/app/globals.css`. Hai điểm đáng chú ý:

- **Trên nền vàng mật luôn dùng chữ đen than.** Chữ trắng trên `#FFC21A` chỉ đạt
  1.9:1 — không đạt. Đen than trên vàng đạt 10.73:1. Đây là lý do `--accent-foreground`
  giữ nguyên `#1C1A17` ở cả hai chế độ.
- **`--border` và `--input` là hai token khác nhau.** `--border` chỉ là nét trang trí
  viền thẻ nên được phép nhạt. `--input` viền ô nhập liệu — thứ duy nhất cho người
  dùng biết đó là ô nhập — nên phải đạt 3:1 theo WCAG 1.4.11.

### Kiểm tra tương phản

```bash
npm run check:contrast
```

`scripts/check-contrast.mjs` tính tỉ lệ tương phản cho từng cặp chữ/nền ở cả hai
chế độ. Hiện **tất cả đều đạt**: chữ ≥ 4.5:1, viền ô nhập ≥ 3:1. Đổi màu thì chạy
lại script này trước khi commit.

## 4. Kích thước và khoảng cách

| Token                           | Giá trị          | Vì sao                                                 |
| ------------------------------- | ---------------- | ------------------------------------------------------ |
| `--radius`                      | `1rem`           | "Thẻ bo góc lớn" — to hơn mặc định 0.625rem của shadcn |
| `--spacing-action` (`h-action`) | `3.25rem` = 52px | Chiều cao tối thiểu của nút hành động chính (câu 7)    |
| `--spacing-tabbar` (`h-tabbar`) | `4rem` = 64px    | Chiều cao thanh tab dưới đáy                           |

Quy ước thêm:

- Ô nhập liệu cao `h-12` (48px) — vẫn thừa ngưỡng chạm 44px, nhưng thấp hơn nút
  chính để nút chính nổi bật hơn.
- Vùng nội dung giới hạn `max-w-md` (448px) và canh giữa, nên trên máy tính app
  hiện như một cột điện thoại chứ không kéo giãn.
- Thanh tab và thanh nút chính đều cộng `env(safe-area-inset-bottom)` để không bị
  vạch home của iPhone che.

## 5. Bố cục chung

```
┌──────────────────────────┐
│ [logo] BeeRoute    [☾]   │  header dính trên, cao 56px
├──────────────────────────┤
│                          │
│  nội dung màn hình       │  max-w-md, px-4
│                          │
├──────────────────────────┤
│  [ nút hành động chính ] │  cố định, cao 52px  (chỉ ở màn có hành động)
├──────────────────────────┤
│  Tuyến đường    Công ty  │  thanh tab, cao 64px
└──────────────────────────┘
```

Màn **Đăng nhập** nằm ngoài vỏ này: không có thanh tab, chỉ có nút đổi theme.

## 6. Bốn màn hình đã dựng

| Màn hình     | Đường dẫn        | File                                                       |
| ------------ | ---------------- | ---------------------------------------------------------- |
| Đăng nhập    | `/login`         | `src/app/login/page.tsx`                                   |
| Tối ưu tuyến | `/`              | `src/app/(app)/page.tsx` → `src/components/route-form.tsx` |
| Chọn công ty | sheet trong `/`  | `src/components/company-picker-sheet.tsx`                  |
| Tạo công ty  | `/companies/new` | `src/components/company-form.tsx`                          |

Dựng thêm `/companies` (danh sách) vì thanh tab có mục "Công ty" — không có trang
này thì bấm vào tab sẽ ra 404.

Toàn bộ đang chạy bằng dữ liệu giả trong `src/lib/mock-data.ts`. **Xoá file đó ở
Giai đoạn 3** khi nối Supabase.

## 7. Quy ước chữ hiển thị

Mọi chữ tiếng Việt nằm trong `src/lib/i18n/vi.ts`. Component không viết chuỗi
tiếng Việt trực tiếp. Chuỗi có số thì khai báo thành hàm, ví dụ
`selectedCount: (n) => \`Đã chọn ${n} công ty\``.

## 8. Còn để ngỏ

- **Chụp ảnh kiểm tra ở đúng 390px.** Chrome trên Windows ép viewport tối thiểu
  500px nên ảnh chụp tự động đang ở 500px. Bố cục giới hạn `max-w-md` = 448px nên
  ở 500px vẫn thấy đúng cột điện thoại, nhưng muốn kiểm tra thật ở 390px thì mở
  DevTools hoặc xem trên điện thoại.
- **Bộ đếm ký tự cho ô "Tên hiển thị"** (tối đa 120) chưa có, vì cần state của
  form. Thêm ở Giai đoạn 3 cùng `react-hook-form`.
- **Nút chọn phương tiện** (xe máy / ô tô) chưa lên giao diện, sẽ nằm cạnh nút
  "Mở trên Google Maps" ở Giai đoạn 5.
