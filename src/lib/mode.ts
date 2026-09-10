import { useEffect, useState } from "react";

export type AppMode = "free" | "pro";

const KEY = "eleva_app_mode";

export function getMode(): AppMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "free" || v === "pro" ? v : null;
}

export function setMode(mode: AppMode) {
  window.localStorage.setItem(KEY, mode);
  window.dispatchEvent(new Event("eleva-mode-change"));
}

export function clearMode() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("eleva-mode-change"));
}

/** Modo elegido tras iniciar sesión. `null` mientras hidrata o si no hay elección. */
export function useAppMode() {
  const [mode, set] = useState<AppMode | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => set(getMode());
    sync();
    setReady(true);
    window.addEventListener("eleva-mode-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("eleva-mode-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { mode, ready, setMode, clearMode };
}
