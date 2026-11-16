"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};

  viewport.addEventListener("resize", onChange);
  viewport.addEventListener("scroll", onChange);
  return () => {
    viewport.removeEventListener("resize", onChange);
    viewport.removeEventListener("scroll", onChange);
  };
}

// Rounded so a sub-pixel jitter while the keyboard animates is not a new
// snapshot, and so the two values stay primitives useSyncExternalStore can
// compare.
const getHeight = () =>
  window.visualViewport ? Math.round(window.visualViewport.height) : null;
const getOffsetTop = () =>
  window.visualViewport ? Math.round(window.visualViewport.offsetTop) : null;
const getServerSnapshot = () => null;

/**
 * The part of the screen the on-screen keyboard is NOT covering.
 *
 * `100dvh` and `bottom: 0` are measured against the layout viewport, which
 * neither iOS Safari nor Android Chrome shrinks when the keyboard opens — so a
 * panel sized that way keeps its lower half under the keys. The visual viewport
 * is the one that does shrink.
 *
 * Returns null on the server and in browsers without the API; callers fall
 * back to `100dvh`.
 */
export function useVisualViewport(): {
  height: number;
  offsetTop: number;
} | null {
  const height = useSyncExternalStore(subscribe, getHeight, getServerSnapshot);
  const offsetTop = useSyncExternalStore(
    subscribe,
    getOffsetTop,
    getServerSnapshot,
  );

  return height === null || offsetTop === null ? null : { height, offsetTop };
}
