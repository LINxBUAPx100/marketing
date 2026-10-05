"use client";

import { ArrowRight, Clock, MoreHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatoCantidad, formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { ETIQUETA_URGENCIA, urgencia } from "@/lib/produccion/reglas";
import { cn } from "@/lib/utils";
import { mover } from "./acciones";
import { DialogoMover, type EtapaOpcion } from "./dialogo-mover";

export type OrdenTarjeta = {
  id: string;
  etapaId: string;
  estado: "activa" | "entregada" | "cancelada";
  folio: string;
  cliente: string | null;
  sucursal: string;
  fechaCompromiso: Date | null;
  actualizadoEn: Date;
  responsableId: string | null;
  responsable: string | null;
  movidoPor: string | null;
  total: number;
  pagado: number;
  partidas: { descripcion: string; cantidad: number; unidad: string }[];
};

const ESTILO_URGENCIA = {
  atrasada: "border-l-destructive",
  hoy: "border-l-amber-500",
  manana: "border-l-sky-500",
  "a-tiempo": "border-l-emerald-500",
  "sin-fecha": "border-l-border",
} as const;

export function TarjetaOrden({
  orden,
  etapas,
  usuarios,
  puedeMover,
  mostrarSucursal,
}: {
  orden: OrdenTarjeta;
  etapas: EtapaOpcion[];
  usuarios: { id: string; nombre: string }[];
  puedeMover: boolean;
  mostrarSucursal: boolean;
}) {
  const [moviendo, iniciar] = useTransition();
  const indice = etapas.findIndex((e) => e.id === orden.etapaId);
  const siguiente = orden.estado === "activa" ? etapas[indice + 1] : undefined;
  const u = orden.estado === "activa" ? urgencia(orden.fechaCompromiso) : "a-tiempo";
  const saldo = orden.total - orden.pagado;

  function avanzar() {
    if (!siguiente) return;
    if (siguiente.tipo === "entregado" && saldo > 0) {
      toast.error(`${orden.folio} tiene saldo de ${formatoMoneda(saldo)}. Cóbralo antes de entregar, o usa el menú ··· para entregar de todos modos.`);
      return;
    }
    iniciar(async () => {
      const r = await mover({ ordenId: orden.id, etapaId: siguiente.id, nota: null });
      if (!r.ok) toast.error(r.mensaje);
      else toast.success(`${orden.folio} → ${siguiente.nombre}`);
    });
  }

  return (
    <article className={cn("bg-card grid gap-2 rounded-lg border border-l-4 p-3 text-sm shadow-xs", ESTILO_URGENCIA[u], moviendo && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/produccion/${orden.id}`} className="font-mono font-semibold hover:underline">
          {orden.folio}
        </Link>
        {orden.estado === "activa" && u !== "a-tiempo" && (
          <Badge variant={u === "atrasada" ? "destructive" : "outline"} className="shrink-0">
            {ETIQUETA_URGENCIA[u]}
          </Badge>
        )}
      </div>
      <p className="truncate font-medium">{orden.cliente ?? "Público en general"}</p>
      <ul className="text-muted-foreground grid gap-0.5 text-xs">
        {orden.partidas.slice(0, 3).map((p, i) => (
          <li key={i} className="truncate">
            {formatoCantidad(p.cantidad)} {p.unidad} · {p.descripcion}
          </li>
        ))}
        {orden.partidas.length > 3 && <li>y {orden.partidas.length - 3} más…</li>}
      </ul>
      <div className="text-muted-foreground grid gap-0.5 text-xs">
        {orden.fechaCompromiso && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> Entrega {formatoFechaHora(orden.fechaCompromiso)}
          </span>
        )}
        <span className="flex items-center gap-1">
          <UserRound className="size-3" /> {orden.responsable ?? "Sin responsable"}
        </span>
        <span>
          Movió {orden.movidoPor ?? "—"} · {formatoFechaHora(orden.actualizadoEn)}
        </span>
        {mostrarSucursal && <span>{orden.sucursal}</span>}
        {saldo > 0 && <span className="text-destructive font-medium">Saldo {formatoMoneda(saldo)}</span>}
      </div>
      {puedeMover && orden.estado === "activa" && (
        <div className="flex gap-1.5 pt-1">
          {siguiente && (
            <Button type="button" size="sm" variant="secondary" className="min-w-0 flex-1" disabled={moviendo} onClick={avanzar}>
              <span className="truncate">{siguiente.nombre}</span> <ArrowRight />
            </Button>
          )}
          <DialogoMover
            orden={{ id: orden.id, folio: orden.folio, etapaId: orden.etapaId, responsableId: orden.responsableId, saldo }}
            etapas={etapas}
            usuarios={usuarios}
            disparador={
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`Mover o asignar ${orden.folio}`}>
                <MoreHorizontal />
              </Button>
            }
          />
        </div>
      )}
    </article>
  );
}
