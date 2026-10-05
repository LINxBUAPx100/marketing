"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aCentavos, centavosATexto, formatoMoneda } from "@/lib/numeros";
import { guardarConvenio } from "../acciones";

type Producto = { id: string; nombre: string; unidad: string; precio: number; precioRevendedor: number | null };
type Inicial = {
  descuento: string;
  diasCredito: string;
  limiteCredito: string;
  vigenteHasta: string;
  notas: string;
  activo: boolean;
  precios: { productoId: string; precio: number }[];
};

export function EditorConvenio({
  clienteId,
  revendedor,
  productos,
  inicial,
  puedeEditar,
}: {
  clienteId: string;
  revendedor: boolean;
  productos: Producto[];
  inicial: Inicial;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [descuento, setDescuento] = useState(inicial.descuento);
  const [diasCredito, setDiasCredito] = useState(inicial.diasCredito);
  const [limite, setLimite] = useState(inicial.limiteCredito);
  const [vigencia, setVigencia] = useState(inicial.vigenteHasta);
  const [notas, setNotas] = useState(inicial.notas);
  const [activo, setActivo] = useState(inicial.activo);
  const [precios, setPrecios] = useState(inicial.precios.map((p) => ({ productoId: p.productoId, precio: centavosATexto(p.precio) })));
  const [nuevo, setNuevo] = useState("");
  const porId = new Map(productos.map((p) => [p.id, p]));
  const lista = (p: Producto) => (revendedor && p.precioRevendedor != null ? p.precioRevendedor : p.precio);

  function guardar() {
    const pct = descuento.trim() ? Number(descuento) : 0;
    const dias = diasCredito.trim() ? Number(diasCredito) : 0;
    const lim = limite.trim() ? aCentavos(limite) : null;
    const especiales = precios.map((p) => ({ productoId: p.productoId, precio: aCentavos(p.precio) }));
    if (!(pct >= 0 && pct <= 90)) return toast.error("El descuento va de 0 a 90 %.");
    if (!(Number.isInteger(dias) && dias >= 0)) return toast.error("Los días de crédito deben ser un número entero.");
    if (lim != null && Number.isNaN(lim)) return toast.error("Escribe un límite de crédito válido.");
    if (especiales.some((p) => Number.isNaN(p.precio))) return toast.error("Revisa los precios especiales.");
    iniciar(async () => {
      const r = await guardarConvenio({
        clienteId,
        descuentoBp: Math.round(pct * 100),
        diasCredito: dias,
        limiteCredito: lim,
        vigenteHasta: vigencia || null,
        notas: notas || null,
        activo,
        precios: especiales,
      });
      if (!r.ok) return void toast.error(r.mensaje);
      toast.success("Convenio guardado.");
      router.refresh();
    });
  }

  return (
    <fieldset disabled={!puedeEditar} className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card className="content-start">
        <CardHeader>
          <CardTitle>Condiciones</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Dato id="descuento" etiqueta="Descuento general (%)" valor={descuento} onChange={setDescuento} ayuda="Se aplica a todo lo que no tenga precio especial." />
          <Dato id="dias" etiqueta="Días de crédito" valor={diasCredito} onChange={setDiasCredito} ayuda="Plazo para pagar; después la venta aparece como vencida." />
          <Dato id="limite" etiqueta="Límite de crédito ($)" valor={limite} onChange={setLimite} ayuda="Vacío = sin límite. Con límite, no se le deja más saldo que eso." />
          <div className="grid gap-1.5">
            <Label htmlFor="vigencia">Vigente hasta</Label>
            <Input id="vigencia" type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
            <p className="text-muted-foreground text-xs">Vacío = sin fecha de término.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notas-convenio">Notas</Label>
            <Textarea id="notas-convenio" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Acuerdo firmado, contacto de compras…" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="accent-primary size-4" />
            Convenio activo
          </label>
        </CardContent>
      </Card>

      <Card className="min-w-0 content-start">
        <CardHeader>
          <CardTitle>Precios especiales</CardTitle>
          <CardDescription>Precio negociado por unidad. Gana sobre el descuento general y los precios por volumen.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {precios.length === 0 && <p className="text-muted-foreground text-sm">Sin precios especiales.</p>}
          {precios.map((p, i) => {
            const prod = porId.get(p.productoId);
            const ahorro = prod ? lista(prod) - aCentavos(p.precio) : 0;
            return (
              <div key={p.productoId} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{prod?.nombre ?? "Producto eliminado"}</span>
                  <span className="text-muted-foreground text-xs">
                    Lista {prod ? formatoMoneda(lista(prod)) : "—"} por {prod?.unidad}
                    {ahorro > 0 && ` · ahorra ${formatoMoneda(ahorro)}`}
                  </span>
                </span>
                <Input
                  inputMode="decimal"
                  value={p.precio}
                  onChange={(e) => setPrecios((ps) => ps.map((x, j) => (j === i ? { ...x, precio: e.target.value } : x)))}
                  aria-label={`Precio especial de ${prod?.nombre}`}
                  className="h-8 tabular-nums"
                />
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar" onClick={() => setPrecios((ps) => ps.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            );
          })}
          <div className="flex gap-2 pt-1">
            <select
              id="producto-convenio"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              aria-label="Producto para precio especial"
              className="border-input bg-background h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-sm"
            >
              <option value="">Agregar producto…</option>
              {productos
                .filter((p) => !precios.some((x) => x.productoId === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!nuevo}
              onClick={() => {
                const prod = porId.get(nuevo);
                setPrecios((ps) => [...ps, { productoId: nuevo, precio: prod ? centavosATexto(lista(prod)) : "" }]);
                setNuevo("");
              }}
            >
              <Plus /> Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      {puedeEditar && (
        <div className="flex justify-end lg:col-span-2">
          <Button type="button" size="lg" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar convenio"}
          </Button>
        </div>
      )}
    </fieldset>
  );
}

function Dato({ id, etiqueta, valor, onChange, ayuda }: { id: string; etiqueta: string; valor: string; onChange: (v: string) => void; ayuda: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value)} className="tabular-nums" />
      <p className="text-muted-foreground text-xs">{ayuda}</p>
    </div>
  );
}
