"use client";

import { Store } from "lucide-react";
import { useTransition } from "react";
import { cambiarSucursal } from "@/app/(app)/acciones-sesion";

export function SelectorSucursal({
  sucursales,
  sucursalId,
}: {
  sucursales: { id: string; nombre: string }[];
  sucursalId: string | null;
}) {
  const [pendiente, iniciar] = useTransition();

  if (!sucursales.length) {
    return <span className="text-destructive text-sm">Sin sucursal asignada</span>;
  }

  return (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <Store className="text-muted-foreground size-4 shrink-0" />
      <span className="sr-only">Sucursal</span>
      <select
        id="sucursal-activa"
        value={sucursalId ?? ""}
        disabled={pendiente || sucursales.length === 1}
        onChange={(e) => iniciar(() => cambiarSucursal(e.target.value))}
        className="hover:bg-muted focus-visible:ring-ring/50 max-w-[60vw] truncate rounded-md bg-transparent py-1 pr-1 font-medium outline-none focus-visible:ring-2 disabled:opacity-100"
      >
        {sucursales.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
