/**
 * Every user-facing string in the app. Code stays in English (CLAUDE.md §3.6);
 * only this file holds Vietnamese, so a second locale is a sibling file later.
 */
export const vi = {
  app: {
    name: "BeeRoute",
    tagline: "Tối ưu tuyến giao hàng",
  },

  theme: {
    switchToDark: "Chuyển sang chế độ tối",
    switchToLight: "Chuyển sang chế độ sáng",
  },

  nav: {
    route: "Tuyến đường",
    companies: "Công ty",
  },

  login: {
    title: "Đăng nhập",
    subtitle: "Đăng nhập để lưu danh sách công ty và sắp xếp tuyến giao hàng.",
    google: "Đăng nhập bằng Google",
    signingIn: "Đang chuyển sang Google…",
    error: "Đăng nhập không thành công:",
    note: "Hiện chỉ hỗ trợ đăng nhập bằng Google.",
  },

  authError: {
    title: "Đăng nhập không thành công",
    body: "Không đổi được mã đăng nhập từ Google. Thử lại, nếu vẫn lỗi thì kiểm tra cấu hình Google OAuth trong Supabase.",
    retry: "Thử lại",
  },

  account: {
    title: "Tài khoản",
    open: "Mở menu tài khoản",
    signOut: "Đăng xuất",
  },

  route: {
    title: "Tối ưu tuyến",
    start: "Điểm bắt đầu",
    end: "Điểm kết thúc",
    useCurrentLocation: "Vị trí hiện tại",
    enterAddress: "Nhập địa chỉ",
    addressPlaceholder: "Dán link Google Maps của địa điểm",
    destinations: "Các điểm đến",
    addDestination: "Thêm điểm đến",
    noDestinations: "Chưa chọn điểm đến nào.",
    noDestinationsHint: 'Bấm "Thêm điểm đến" để chọn công ty cần giao.',
    removeDestination: "Xoá điểm này",
    optimize: "Tối ưu tuyến",
    locating: "Đang lấy vị trí…",
    currentLocationHint:
      "Trình duyệt sẽ hỏi quyền truy cập vị trí khi bấm Tối ưu tuyến.",
    errorNoDestinations: "Phải chọn ít nhất một điểm đến.",
    errorNoStart:
      "Chưa có toạ độ điểm bắt đầu. Chọn địa chỉ từ gợi ý hoặc dán toạ độ.",
    errorNoEnd:
      "Chưa có toạ độ điểm kết thúc. Chọn địa chỉ từ gợi ý hoặc dán toạ độ.",
    errorGeneric: "Không tính được tuyến. Thử lại.",
    splitNote: (n: number) =>
      `Tuyến dài quá giới hạn của một link Google Maps nên được chia thành ${n} chặng. Chạy xong chặng này thì mở chặng kế tiếp.`,
    resultTitle: "Thứ tự đã tối ưu",
    startLabel: "Bắt đầu",
    endLabel: "Kết thúc",
    totalDistance: "Tổng quãng đường",
    straightLineNote:
      "Khoảng cách đường chim bay, chỉ dùng để sắp thứ tự. Đường đi thật do Google Maps tính.",
    openInMaps: "Mở trên Google Maps",
    openLeg: (n: number) => `Mở chặng ${n}`,
    travelMode: "Phương tiện",
    motorbike: "Xe máy",
    car: "Ô tô",
    contacts: "Liên hệ",
    note: "Ghi chú",
  },

  address: {
    placeholder: "Dán link Google Maps của địa điểm",
    hint: "Tìm địa điểm trên Google Maps rồi dán link vào đây. Dán toạ độ dạng 10.749046, 106.635174 cũng được.",
    shortLink:
      "Link rút gọn chưa có toạ độ. Mở nó trên Google Maps rồi chép link đầy đủ trên thanh địa chỉ.",
  },

  geo: {
    unsupported:
      "Trình duyệt này không hỗ trợ lấy vị trí. Dán link Google Maps thay nhé.",
    denied:
      "Bạn đã từ chối quyền vị trí. Bật lại trong cài đặt trình duyệt, hoặc chuyển sang Nhập địa chỉ.",
    timeout: "Lấy vị trí quá lâu. Thử lại hoặc nhập địa chỉ tay.",
    failed: "Không lấy được vị trí. Thử lại hoặc nhập địa chỉ tay.",
  },

  picker: {
    title: "Chọn công ty",
    description: "Chọn các công ty cần giao trong chuyến này.",
    search: "Tìm theo tên hoặc địa chỉ",
    selectedCount: (n: number) => `Đã chọn ${n} công ty`,
    done: "Xong",
    cancel: "Huỷ",
    empty: "Chưa có công ty nào.",
    notFound: "Không tìm thấy công ty phù hợp.",
    create: "Tạo công ty mới",
  },

  companies: {
    title: "Công ty",
    search: "Tìm công ty",
    create: "Tạo công ty",
    empty: "Chưa có công ty nào.",
    emptyHint: "Tạo công ty để dùng làm điểm giao hàng.",
    contactCount: (n: number) => `${n} số liên hệ`,
    publicBadge: "Công khai",
    noContact: "Chưa có số liên hệ",
  },

  companyForm: {
    createTitle: "Tạo công ty",
    editTitle: "Sửa công ty",
    displayName: "Tên hiển thị",
    displayNamePlaceholder: "Ví dụ: Kho Tân Bình",
    address: "Địa chỉ",
    addressPlaceholder: "Dán link Google Maps của địa điểm",
    addressHint: "Phải có toạ độ thì mới lưu được.",
    coordinates: "Toạ độ",
    contacts: "Liên hệ",
    contactsHint:
      "Thêm được nhiều dòng. Dòng để trống hoàn toàn sẽ không được lưu.",
    isPublic: "Cho người khác tìm thấy công ty này",
    isPublicHint:
      "Bật lên thì mọi người dùng BeeRoute khác đều xem được công ty này, kể cả số liên hệ và ghi chú. Tắt thì chỉ mình bạn thấy.",
    deleteConfirmTitle: "Xoá công ty này?",
    deleteConfirmBody: (name: string) =>
      `Xoá "${name}" và toàn bộ số liên hệ của nó. Không khôi phục được.`,
    contactName: "Người liên hệ / phòng ban",
    contactNamePlaceholder: "Ví dụ: Anh Hùng - kho",
    phone: "Số điện thoại",
    phonePlaceholder: "0901234567",
    addContact: "Thêm liên hệ",
    removeContact: "Xoá liên hệ này",
    note: "Ghi chú",
    notePlaceholder:
      "Việc cần làm khi tới nơi: gọi ai, thủ tục vào cổng, có lấy mẫu không…",
    save: "Lưu",
    cancel: "Huỷ",
    delete: "Xoá công ty",
  },

  common: {
    required: "Bắt buộc",
    optional: "Không bắt buộc",
    back: "Quay lại",
    close: "Đóng",
    km: "km",
  },
} as const;
