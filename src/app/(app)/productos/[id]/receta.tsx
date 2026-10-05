"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { costoReceta, ingresoSinIva } from "@/lib/almacen/reglas";
import { formatoCostoUnitario, formatoMoneda } from "@/lib/numeros";
import type { ConfigIva } from "@/lib/ventas/calculo";
import { guardarReceta } from "../../insumos/acciones";

type InsumoOpcion = { id: string; nombre: string; unidad: string; costo: number };
type Renglon = { insumoId: string; cantidad: string };

export function EditorReceta({
  productoId,
  unidadProducto,
  precio,
  iva,
  insumos,
  inicial,
  puedeEditar,
}: {
  productoId: string;
  unidadProducto: string;
  precio: number;
  iva: ConfigIva;
  insumos: InsumoOpcion[];
  inicial: { insumoId: string; cantidad: number }[];
  puedeEditar: boolean;
}) {
  const [renglones, setRenglones] = useState<Renglon[]>(inicial.map((r) => ({ insumoId: r.insumoId, cantidad: String(r.cantidad) })));
  const [nuevo, setNuevo] = useState("");
  const [guardando, iniciar] = useTransition();
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const cambiado = JSON.stringify(renglones) !== JSON.stringify(inicial.map((r) => ({ insumoId: r.insumoId, cantidad: String(r.cantidad) })));

  const calculables = renglones
    .map((r) => ({ insumoId: r.insumoId, cantidad: Number(r.cantidad.replace(",", ".")), costoInsumo: porId.get(r.insumoId)?.costo ?? 0 }))
    .filter((r) => r.cantidad > 0);
  const costo = costoReceta(calculables);
  const ingreso = ingresoSinIva(precio, iva);
  const margen = ingreso > 0 ? (ingreso - costo) / ingreso : null;
  const invalido = renglones.some((r) => !(Number(r.cantidad.replace(",", ".")) > 0));

  function guardar() {
    if (invalido) return toast.error("Cada insumo necesita una cantidad mayor que cero.");
    iniciar(async () => {
      const r = await guardarReceta({ productoId, renglones: calculables.map(({ insumoId, cantidad }) => ({ insumoId, cantidad })) });
      if (!r.ok) toast.error(r.mensaje);
      else toast.success(renglones.length ? "Receta guardada." : "Receta quitada.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receta</CardTitle>
        <CardDescription>
          Insumos que lleva 1 {unidadProducto}. Al vender se descuentan de la sucursal y dan el costo real.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {renglones.length === 0 && <p className="text-muted-foreground text-sm">Sin receta. El costo se toma del campo «Costo» del producto.</p>}
        {renglones.map((r, i) => {
          const insumo = porId.get(r.insumoId);
          const subtotal = (Number(r.cantidad.replace(",", ".")) || 0) * (insumo?.costo ?? 0);
          return (
            <div key={r.insumoId} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{insumo?.nombre ?? "Insumo eliminado"}</span>
                <span className="text-muted-foreground text-xs">
                  {insumo ? `${formatoCostoUnitario(insumo.costo)} por ${insumo.unidad} · ` : ""}
                  {formatoMoneda(Math.round(subtotal))}
                </span>
              </span>
              <label className="flex items-center gap-1">
                <Input
                  inputMode="decimal"
                  value={r.cantidad}
                  disabled={!puedeEditar}
                  aria-label={`Cantidad de ${insumo?.nombre}`}
                  onChange={(e) => setRenglones((rs) => rs.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))}
                  className="h-7 tabular-nums"
                />
                <span className="text-muted-foreground w-10 truncate text-xs">{insumo?.unidad}</span>
              </label>
              {puedeEditar ? (
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar insumo" onClick={() => setRenglones((rs) => rs.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              ) : (
                <span />
              )}
            </div>
          );
        })}

        {puedeEditar && (
          <div className="flex gap-2">
            <select
              id="agregar-insumo"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              aria-label="Insumo para agregar"
              className="border-input bg-background h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-sm"
            >
              <option value="">Agregar insumo…</option>
              {insumos
                .filter((i) => !renglones.some((r) => r.insumoId === i.id))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.unidad})
                  </option>
                ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!nuevo}
              onClick={() => {
                setRenglones((rs) => [...rs, { insumoId: nuevo, cantidad: "1" }]);
                setNuevo("");
              }}
            >
              <Plus /> Agregar
            </Button>
          </div>
        )}

        <dl className="grid gap-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Costo por {unidadProducto}</dt>
            <dd className="font-medium tabular-nums">{formatoMoneda(Math.round(costo))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Precio sin IVA</dt>
            <dd className="tabular-nums">{formatoMoneda(ingreso)}</dd>
          </div>
          {margen != null && calculables.length > 0 && (
            <div className={`flex justify-between font-semibold ${margen < 0.2 ? "text-destructive" : "text-emerald-700"}`}>
              <dt>Margen</dt>
              <dd className="tabular-nums">
                {formatoMoneda(Math.round(ingreso - costo))} · {Math.round(margen * 100)} %
              </dd>
            </div>
          )}
        </dl>
        {puedeEditar && cambiado && (
          <Button type="button" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar receta"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
