"use client";

import { Bell, CalendarClock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { marcarLeidas, misAvisos, type Aviso } from "@/app/(app)/avisos";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatoFechaHora } from "@/lib/numeros";
import { cn } from "@/lib/utils";

/** Campana de avisos. Pregunta al servidor cada 30 s mientras la pestaña está visible. */
export function Campana() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [pendientes, setPendientes] = useState(0);

  const cargar = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const r = await misAvisos();
      setAvisos(r.avisos);
      setPendientes(r.pendientes);
    } catch {
      // Sin conexión: se reintenta en el siguiente ciclo.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de un recurso externo
    cargar();
    const intervalo = setInterval(cargar, 30_000);
    document.addEventListener("visibilitychange", cargar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", cargar);
    };
  }, [cargar]);

  return (
    <DropdownMenu
      onOpenChange={(abierto) => {
        // Al cerrar, las notificaciones vistas quedan leídas (los seguimientos siguen hasta marcarlos hechos).
        if (!abierto && avisos.some((a) => a.tipo === "notificacion" && !a.leida)) {
          marcarLeidas().then(cargar);
        }
      }}
    >
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label={`Avisos${pendientes ? `: ${pendientes} sin ver` : ""}`} />}>
        <Bell />
        {pendientes > 0 && (
          <span className="bg-destructive absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[0.625rem] leading-4 font-semibold text-white tabular-nums">
            {pendientes > 9 ? "9+" : pendientes}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="border-b px-3 py-2">Avisos</DropdownMenuLabel>
        </DropdownMenuGroup>
        <ul className="max-h-96 overflow-y-auto">
          {avisos.length === 0 && <li className="text-muted-foreground px-3 py-6 text-center text-sm">Sin avisos por ahora.</li>}
          {avisos.map((a) => {
            const contenido = (
              <>
                <span className="flex items-center gap-1.5 font-medium">
                  {a.tipo === "seguimiento" && <CalendarClock className="text-destructive size-3.5 shrink-0" />}
                  <span className="truncate">{a.titulo}</span>
                </span>
                {a.mensaje && <span className="text-muted-foreground line-clamp-2 text-xs">{a.mensaje}</span>}
                <span className="text-muted-foreground text-[0.7rem]">{formatoFechaHora(a.fecha)}</span>
              </>
            );
            const clase = cn("hover:bg-muted grid gap-0.5 border-b px-3 py-2 text-sm last:border-0", !a.leida && "bg-primary/5");
            return (
              <li key={a.id}>
                {a.enlace ? (
                  <Link href={a.enlace} className={cn(clase, "block outline-none focus-visible:bg-muted")}>
                    {contenido}
                  </Link>
                ) : (
                  <div className={clase}>{contenido}</div>
                )}
              </li>
            );
          })}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
