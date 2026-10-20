"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Lang } from "./strings";

const LANG_KEY = "meenmitra.farmer.lang";
const POND_KEY = "meenmitra.farmer.pond";
const EVENT = "meenmitra-farmer-prefs";

// localStorage can be unavailable (private mode, blocked storage); fall back to defaults then.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preference is only a convenience; the screen still works for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Farmer-screen language. Kannada unless the farmer switched to English on this device. */
export function useFarmerLang(): [Lang, (lang: Lang) => void] {
  const lang = useSyncExternalStore(
    subscribe,
    () => (read(LANG_KEY) === "en" ? "en" : "kn"),
    () => "kn" as const,
  );
  const set = useCallback((next: Lang) => write(LANG_KEY, next), []);
  return [lang, set];
}

/** The pond this device last opened, so a farmer does not have to pick it every time. */
export function useRememberedPond(): [string | null, (id: string) => void] {
  const id = useSyncExternalStore(subscribe, () => read(POND_KEY), () => null);
  const set = useCallback((next: string) => write(POND_KEY, next), []);
  return [id, set];
}
