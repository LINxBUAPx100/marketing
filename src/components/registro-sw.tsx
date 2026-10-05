"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Registra el service worker (solo en producción) y le pide guardar el punto de venta para usarlo sin conexión. */
export function RegistroSw() {
  const ruta = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // En desarrollo el worker estorbaría a la recarga en caliente.
      void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      return;
    }
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || ruta !== "/ventas/nueva" || !("serviceWorker" in navigator) || !navigator.onLine) return;
    void navigator.serviceWorker.ready.then((r) => {
      const urls = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((u) => u.includes("/_next/static/"));
      r.active?.postMessage({ tipo: "guardar", urls, pagina: ruta });
    });
  }, [ruta]);

  return null;
}
