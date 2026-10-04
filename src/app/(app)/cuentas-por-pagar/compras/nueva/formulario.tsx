"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { aNumero, SelectorArticulos, type Articulo, type LineaArticulo } from "@/components/almacen/selector-articulos";
import { Selector } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ETIQUETA_METODO, METODOS, type Metodo } from "@/lib/caja/resumen";
import { aCentavos, formatoMoneda } from "@/lib/numeros";
import { guardarCompra } from "../../acciones";
import { DialogoProveedor } from "../../proveedores/dialogo";

type Proveedor = { id: string; nombre: string; diasCredito: number };

export function FormularioCompra({
  articulos,
  proveedores: iniciales,
  hoy,
  sucursal,
  puedePagar,
}: {
  articulos: Articulo[];
  proveedores: Proveedor[];
  hoy: string;
  sucursal: string;
  puedePagar: boolean;
}) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [proveedores, setProveedores] = useState(iniciales);
  const [proveedorId, setProveedorId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [diasCredito, setDiasCredito] = useState("0");
  const [notas, setNotas] = useState("");
  const [actualizarCostos, setActualizarCostos] = useState(true);
  const [lineas, setLineas] = useState<LineaArticulo[]>([]);
  const [pagarAhora, setPagarAhora] = useState(false);
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [montoPago, setMontoPago] = useState("");
  const [desdeCaja, setDesdeCaja] = useState(true);

  const total = lineas.reduce((s, l) => s + Math.round(aNumero(l.cantidad) * aNumero(l.costo) * 100 || 0), 0);
  const credito = Number(diasCredito) || 0;

  function elegirProveedor(id: string) {
    setProveedorId(id);
    const p = proveedores.find((x) => x.id === id);
    if (p) {
      setDiasCredito(String(p.diasCredito));
      setPagarAhora(p.diasCredito === 0);
    }
  }

  function guardar() {
    if (!proveedorId) return toast.error("Elige el proveedor.");
    if (!lineas.length) return toast.error("Agrega lo que se compró.");
    const partidas = lineas.map((l) => ({
      tipo: l.tipo,
      id: l.id,
      cantidad: aNumero(l.cantidad),
      costoUnitario: Math.round(aNumero(l.costo) * 1_000_000) / 10_000,
    }));
    if (partidas.some((p) => !(p.cantidad > 0) || !(p.costoUnitario >= 0))) return toast.error("Revisa cantidades y costos marcados en rojo.");
    const monto = pagarAhora ? (montoPago.trim() ? aCentavos(montoPago) : total) : 0;
    if (pagarAhora && !(monto > 0 && monto <= total)) return toast.error("El pago debe ser mayor que cero y no pasar del total.");

    iniciar(async () => {
      const r = await guardarCompra({
        proveedorId,
        referencia: referencia || null,
        fecha,
        diasCredito: credito,
        notas: notas || null,
        actualizarCostos,
        partidas,
        pago: pagarAhora ? { metodo, monto, referencia: null, desdeCaja: metodo === "efectivo" && desdeCaja } : null,
      });
      if (!r.ok) return void toast.error(r.mensaje);
      toast.success("Compra registrada; las existencias ya se sumaron.");
      router.push(`/cuentas-por-pagar/compras/${r.id}`);
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Qué se compró</CardTitle>
        </CardHeader>
        <CardContent>
          <SelectorArticulos articulos={articulos} lineas={lineas} onChange={setLineas} conCosto etiquetaExistencia={`En ${sucursal}`} />
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={actualizarCostos}
              onChange={(e) => setActualizarCostos(e.target.checked)}
              className="accent-primary mt-0.5 size-4"
            />
            <span>
              Actualizar el costo de cada artículo con el de esta compra
              <span className="text-muted-foreground block text-xs">Así las recetas y la utilidad usan el precio más reciente.</span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Compra</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-end gap-2">
            <Selector
              etiqueta="Proveedor"
              nombre="proveedorId"
              value={proveedorId}
              onChange={(e) => elegirProveedor(e.target.value)}
              className="min-w-0 flex-1"
            >
              <option value="">Elige…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
            <DialogoProveedor
              disparador={
                <Button type="button" variant="outline" size="icon" aria-label="Registrar proveedor nuevo">
                  <Plus />
                </Button>
              }
              alGuardar={(r) => {
                const p = r.datos as Proveedor;
                setProveedores((ps) => [...ps, p].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                elegirProveedor(p.id);
                setDiasCredito(String(p.diasCredito));
                setPagarAhora(p.diasCredito === 0);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="referencia">Factura o nota</Label>
              <Input id="referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="A-1234" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fecha-compra">Fecha</Label>
              <Input id="fecha-compra" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="credito">Días de crédito</Label>
              <Input id="credito" type="number" min="0" max="365" value={diasCredito} onChange={(e) => setDiasCredito(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notas-compra">Notas</Label>
            <Textarea id="notas-compra" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="font-medium">Total</span>
            <span className="text-lg font-semibold tabular-nums">{formatoMoneda(total)}</span>
          </div>

          {puedePagar && (
            <div className="grid gap-3 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={pagarAhora} onChange={(e) => setPagarAhora(e.target.checked)} className="accent-primary size-4" />
                Se pagó ahora
              </label>
              {pagarAhora && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Selector etiqueta="Método" nombre="metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as Metodo)}>
                      {METODOS.map((m) => (
                        <option key={m} value={m}>
                          {ETIQUETA_METODO[m]}
                        </option>
                      ))}
                    </Selector>
                    <div className="grid gap-1.5">
                      <Label htmlFor="monto-pago">Monto</Label>
                      <Input
                        id="monto-pago"
                        inputMode="decimal"
                        value={montoPago}
                        placeholder={(total / 100).toFixed(2)}
                        onChange={(e) => setMontoPago(e.target.value)}
                      />
                    </div>
                  </div>
                  {metodo === "efectivo" && (
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={desdeCaja} onChange={(e) => setDesdeCaja(e.target.checked)} className="accent-primary mt-0.5 size-4" />
                      <span>
                        Salió de la caja de {sucursal}
                        <span className="text-muted-foreground block text-xs">Se registra como gasto «Pago a proveedor» en el corte.</span>
                      </span>
                    </label>
                  )}
                </>
              )}
              {!pagarAhora && <p className="text-muted-foreground text-xs">Queda en cuentas por pagar{credito ? `, vence en ${credito} días` : ""}.</p>}
            </div>
          )}

          <Button type="button" size="lg" onClick={guardar} disabled={guardando || !lineas.length}>
            {guardando ? "Guardando…" : `Registrar compra · ${formatoMoneda(total)}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
