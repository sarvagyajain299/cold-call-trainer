"use client";

import { useSyncExternalStore } from "react";

const KEY = "theme";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

const isDark = () => document.documentElement.classList.contains("dark");

export default function ThemeToggle() {
  // Server render assumes night; the real value is read from <html> on the client.
  const dark = useSyncExternalStore(subscribe, isDark, () => true);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to day mode" : "Switch to night mode"}
      title={dark ? "Switch to day mode" : "Switch to night mode"}
      suppressHydrationWarning
      className="fixed right-4 top-4 z-50 flex h-9 items-center gap-2 rounded-full border bg-background px-3 text-sm shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 print:hidden"
    >
      <span aria-hidden suppressHydrationWarning>{dark ? "☀️" : "🌙"}</span>
      <span suppressHydrationWarning>{dark ? "Day" : "Night"}</span>
    </button>
  );
}
