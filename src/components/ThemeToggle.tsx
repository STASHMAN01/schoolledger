"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Explicit light/dark override, on top of whatever the OS prefers.
 * Research on this is genuinely split (roughly a third light, a third
 * dark, a third "depends") — there's no default that satisfies everyone,
 * so this exists specifically so nobody's stuck with the choice we made
 * for them. The actual switching happens via `data-theme` on <html>
 * (see globals.css); the blocking script in layout.tsx applies a saved
 * choice before first paint so there's no flash of the wrong theme.
 */
export function ThemeToggle() {
  // Starts null so the icon doesn't render (and mismatch) before the
  // client can read localStorage/matchMedia — see the fixed-size wrapper
  // below, which keeps the header from jumping once it does render.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Reads from localStorage/matchMedia, which don't exist during SSR —
    // this has to run as a mount effect, not a lazy initializer, to avoid a
    // hydration mismatch between server and client markup.
    const stored = window.localStorage.getItem("theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(stored === "light" || stored === "dark" ? stored : getSystemTheme());
  }, []);

  function toggle() {
    const next: Theme = (theme ?? getSystemTheme()) === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="transition-standard flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
    >
      {theme === "dark" ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : theme === "light" ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
        </svg>
      ) : (
        // Not yet mounted — invisible placeholder holding the same box size.
        <span className="block h-[18px] w-[18px]" />
      )}
    </button>
  );
}
