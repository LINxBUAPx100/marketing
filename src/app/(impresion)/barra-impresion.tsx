"use client";

import { Printer, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Botones que no salen en papel. Abre el diálogo de impresión al cargar. */
export function BarraImpresion({ automatico = true }: { automatico?: boolean }) {
  useEffect(() => {
    if (!automatico) return;
    // Pequeña espera para que carguen fuentes e imágenes antes de imprimir.
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [automatico]);

  return (
    <div className="flex justify-center gap-2 border-b bg-neutral-100 py-3 print:hidden">
      <Button type="button" onClick={() => window.print()}>
        <Printer /> Imprimir o guardar PDF
      </Button>
      <Button type="button" variant="outline" onClick={() => window.close()}>
        <X /> Cerrar
      </Button>
    </div>
  );
}
