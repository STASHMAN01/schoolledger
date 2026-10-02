"use client";

import { useEffect } from "react";

// Registers /sw.js so the site can be installed as an app and shows a
// proper offline screen. Production only: in development a service worker
// just gets in the way of hot reloading.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not fatal: the site works the same without it.
    });
  }, []);
  return null;
}
