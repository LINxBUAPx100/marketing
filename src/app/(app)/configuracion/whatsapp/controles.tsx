"use client";

import { RotateCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Plantilla } from "@/lib/mensajes/plantillas";
import { guardarAvisos, reintentar } from "./acciones";

export function AvisosAutomaticos({ plantillas, activos, puedeEditar }: { plantillas: Plantilla[]; activos: string[]; puedeEditar: boolean }) {
  const [elegidos, setElegidos] = useState(activos);
  const [guardando, iniciar] = useTransition();
  const cambio = elegidos.length !== activos.length || elegidos.some((c) => !activos.includes(c));

  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {plantillas.map((p) => (
          <li key={p.clave}>
            <label className="has-checked:border-primary has-checked:bg-primary/5 flex items-start gap-2.5 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="accent-primary mt-0.5 size-4"
                disabled={!puedeEditar}
                checked={elegidos.includes(p.clave)}
                onChange={(e) => setElegidos((l) => (e.target.checked ? [...l, p.clave] : l.filter((c) => c !== p.clave)))}
              />
              <span className="grid gap-0.5">
                <span className="font-medium">{p.nombre}</span>
                <span className="text-muted-foreground text-xs">{p.descripcion}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {puedeEditar && (
        <Button
          type="button"
          className="justify-self-start"
          disabled={!cambio || guardando}
          onClick={() =>
            iniciar(async () => {
              const r = await guardarAvisos(elegidos);
              if (r.ok) toast.success("Avisos automáticos guardados.");
              else toast.error(r.mensaje);
            })
          }
        >
          {guardando ? "Guardando…" : "Guardar avisos"}
        </Button>
      )}
    </div>
  );
}

export function BotonReintentar({ id }: { id: string }) {
  const [enviando, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Reintentar envío"
      title="Reintentar envío"
      disabled={enviando}
      onClick={() =>
        iniciar(async () => {
          const r = await reintentar(id);
          if (r.ok && r.estado === "enviado") toast.success(r.mensaje);
          else toast.error(r.mensaje);
        })
      }
    >
      <RotateCw className={enviando ? "animate-spin" : undefined} />
    </Button>
  );
}
