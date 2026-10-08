"use client";

// Inside the Android app, this tells the tablet to (re-)hand its push token
// to the server whenever the dashboard mounts. The app also tries this on
// its own right after a cold page load, but that native hook never re-fires
// after a client-side (SPA) navigation -- which is exactly what a sign-in
// redirect to /dashboard normally is. Mounting here, instead, catches every
// case: first load already signed in, and signing in and landing here
// without a full page reload. Does nothing in a normal browser.
import { useEffect } from "react";
import { appRegisterPush, inApp } from "@/lib/appBridge";

export function PushRegister() {
  useEffect(() => {
    if (!inApp()) return;

    appRegisterPush();
    const onVisible = () => {
      if (document.visibilityState === "visible") appRegisterPush();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
