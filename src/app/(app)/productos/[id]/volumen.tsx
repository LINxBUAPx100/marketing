"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { aCentavos, centavosATexto } from "@/lib/numeros";
import { guardarVolumen } from "../acciones";

type Escalon = { desde: string; precio: string; precioRevendedor: string };
type Inicial = { desde: number; precio: number; precioRevendedor: number | null };

export function EditorVolumen({ productoId, unidad, inicial, puedeEditar }: { productoId: string; unidad: string; inicial: Inicial[]; puedeEditar: boolean }) {
  const aTexto = (e: Inicial): Escalon => ({ desde: String(e.desde), precio: centavosATexto(e.precio), precioRevendedor: centavosATexto(e.precioRevendedor) });
  const [escalones, setEscalones] = useState<Escalon[]>(inicial.map(aTexto));
  const [guardando, iniciar] = useTransition();
  const cambiado = JSON.stringify(escalones) !== JSON.stringify(inicial.map(aTexto));
  const cambiar = (i: number, c: Partial<Escalon>) => setEscalones((es) => es.map((x, j) => (j === i ? { ...x, ...c } : x)));

  function guardar() {
    const datos = escalones.map((e) => ({
      desde: Number(e.desde.replace(",", ".")),
      precio: aCentavos(e.precio),
      precioRevendedor: e.precioRevendedor.trim() ? aCentavos(e.precioRevendedor) : null,
    }));
    if (datos.some((d) => !(d.desde > 0) || Number.isNaN(d.precio) || (d.precioRevendedor != null && Number.isNaN(d.precioRevendedor)))) {
      return toast.error("Revisa cantidades y precios.");
    }
    iniciar(async () => {
      const r = await guardarVolumen({ productoId, escalones: datos.sort((a, b) => a.desde - b.desde) });
      if (!r.ok) toast.error(r.mensaje);
      else toast.success("Precios por volumen guardados.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Precios por volumen</CardTitle>
        <CardDescription>Desde cierta cantidad, cada {unidad} cuesta menos. Se aplica solo al vender o cotizar.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {escalones.length === 0 && <p className="text-muted-foreground text-sm">Sin escalones: siempre se cobra el precio de lista.</p>}
        {escalones.length > 0 && (
          <div className="text-muted-foreground grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs">
            <span>Desde ({unidad})</span>
            <span>Precio público</span>
            <span>Revendedor</span>
            <span className="w-7" />
          </div>
        )}
        {escalones.map((e, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
            <Input inputMode="decimal" value={e.desde} disabled={!puedeEditar} onChange={(v) => cambiar(i, { desde: v.target.value })} aria-label="Desde cuántas unidades" className="h-8 tabular-nums" />
            <Input inputMode="decimal" value={e.precio} disabled={!puedeEditar} onChange={(v) => cambiar(i, { precio: v.target.value })} aria-label="Precio público" className="h-8 tabular-nums" />
            <Input inputMode="decimal" value={e.precioRevendedor} placeholder="Igual" disabled={!puedeEditar} onChange={(v) => cambiar(i, { precioRevendedor: v.target.value })} aria-label="Precio revendedor" className="h-8 tabular-nums" />
            {puedeEditar ? (
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar escalón" onClick={() => setEscalones((es) => es.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            ) : (
              <span />
            )}
          </div>
        ))}
        {puedeEditar && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setEscalones((es) => [...es, { desde: "", precio: "", precioRevendedor: "" }])} disabled={escalones.length >= 10}>
              <Plus /> Agregar escalón
            </Button>
            {cambiado && (
              <Button type="button" size="sm" onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar precios"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
