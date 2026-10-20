"use client";

import { useSyncExternalStore } from "react";

const supported = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/**
 * True while `query` matches. Always false during server rendering and where matchMedia is
 * unavailable (e.g. jsdom in tests), so callers fall back to their default (desktop) layout.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!supported()) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => supported() && window.matchMedia(query).matches,
    () => false,
  );
}
