"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Vuelve a pedir los datos de la página cada cierto tiempo mientras la pestaña está visible,
 * para que el tablero se mantenga al día sin recargar. No pierde lo que haya abierto en pantalla.
 */
export function AutoRefresco({ segundos = 15 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const intervalo = setInterval(refrescar, segundos * 1000);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [router, segundos]);
  return null;
}
