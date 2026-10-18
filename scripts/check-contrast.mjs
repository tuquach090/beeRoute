const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h) => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const PAIRS = {
  SÁNG: [
    ["chữ thường / nền trang", "#1C1A17", "#F4F7FE"],
    ["chữ thường / thẻ", "#1C1A17", "#FFFFFF"],
    ["chữ phụ / thẻ", "#5A6479", "#FFFFFF"],
    ["chữ phụ / nền trang", "#5A6479", "#F4F7FE"],
    ["chữ nút chính", "#FFFFFF", "#2F5BEA"],
    ["chữ trên vàng mật", "#1C1A17", "#FFC21A"],
    ["chữ trên xanh nhạt", "#1B3BA8", "#E8F0FF"],
    ["chữ nút xoá", "#FFFFFF", "#D92D20"],
    ["viền ô nhập / thẻ [UI 3:1]", "#878FA3", "#FFFFFF"],
    ["viền ô nhập / nền trang [UI 3:1]", "#878FA3", "#F4F7FE"],
  ],
  TỐI: [
    ["chữ thường / nền trang", "#ECEFF6", "#101218"],
    ["chữ thường / thẻ", "#ECEFF6", "#181B23"],
    ["chữ phụ / thẻ", "#98A2B8", "#181B23"],
    ["chữ phụ / nền trang", "#98A2B8", "#101218"],
    ["chữ nút chính", "#FFFFFF", "#3F66F0"],
    ["chữ trên vàng mật", "#1C1A17", "#FFC21A"],
    ["chữ trên nền phụ", "#C9D6FF", "#1E2536"],
    ["chữ nút xoá", "#1C1A17", "#F0584B"],
    ["viền ô nhập / thẻ [UI 3:1]", "#5C677E", "#181B23"],
    ["viền ô nhập / nền trang [UI 3:1]", "#5C677E", "#101218"],
  ],
};

let fail = 0;
for (const [mode, pairs] of Object.entries(PAIRS)) {
  console.log(`\n=== CHẾ ĐỘ ${mode} ===`);
  for (const [name, fg, bg] of pairs) {
    const r = ratio(fg, bg);
    const need = name.includes("[UI 3:1]") ? 3 : 4.5;
    const ok = r >= need;
    if (!ok) fail++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (cần ${need})  ${name}  ${fg} trên ${bg}`,
    );
  }
}
console.log(`\n${fail === 0 ? "TẤT CẢ ĐẠT" : fail + " CẶP KHÔNG ĐẠT"}`);
