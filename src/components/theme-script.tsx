export const THEME_STORAGE_KEY = "beeroute-theme";

// Runs before first paint so a dark-mode load never flashes the light palette.
// Kept as a raw string: it must execute synchronously, ahead of hydration.
const script = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {
    // Private mode or blocked storage: fall back to the light palette.
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
