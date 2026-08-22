"use client";

import { useEffect } from "react";

const SW_VERSION = "v4"; // bump on deploy to force client update

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // ?v= query param forces the browser to refetch the SW file when bumped,
    // which causes the install handler to fire and replace the old SW.
    navigator.serviceWorker.register(`/sw.js?v=${SW_VERSION}`).catch(() => {
      // Silent failure in dev
    });
  }, []);
  return null;
}
