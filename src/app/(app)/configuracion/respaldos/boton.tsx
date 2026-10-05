"use client";

import { DatabaseBackup } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { respaldarAhora } from "./acciones";

export function BotonRespaldar() {
  const [guardando, iniciar] = useTransition();
  return (
    <Button
      type="button"
      disabled={guardando}
      onClick={() =>
        iniciar(async () => {
          const r = await respaldarAhora();
          if (r.ok) toast.success(`Respaldo ${r.nombre} guardado.`);
          else toast.error(r.mensaje);
        })
      }
    >
      <DatabaseBackup /> {guardando ? "Respaldando…" : "Respaldar ahora"}
    </Button>
  );
}
