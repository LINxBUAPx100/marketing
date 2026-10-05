"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { aNumero, SelectorArticulos, type Articulo, type LineaArticulo } from "@/components/almacen/selector-articulos";
import { Selector } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { guardarTraspaso } from "../../acciones";

type Sucursal = { id: string; nombre: string };

export function FormularioTraspaso({
  origenes,
  destinos,
  articulosPorSucursal,
  origenInicial,
}: {
  origenes: Sucursal[];
  destinos: Sucursal[];
  articulosPorSucursal: Record<string, Articulo[]>;
  origenInicial: string | undefined;
}) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [origenId, setOrigenId] = useState(origenInicial ?? "");
  const [destinoId, setDestinoId] = useState(destinos.find((d) => d.id !== origenInicial)?.id ?? "");
  const [lineas, setLineas] = useState<LineaArticulo[]>([]);
  const [notas, setNotas] = useState("");
  const articulos = articulosPorSucursal[origenId] ?? [];

  // Si se manda más de lo que hay, se avisa (puede ser un conteo atrasado), pero no se bloquea.
  const excedidos = lineas.filter((l) => aNumero(l.cantidad) > (articulos.find((a) => a.tipo === l.tipo && a.id === l.id)?.existencia ?? 0));

  function guardar() {
    if (!origenId || !destinoId || origenId === destinoId) return toast.error("Elige dos sucursales distintas.");
    if (!lineas.length) return toast.error("Agrega lo que se va a traspasar.");
    const partidas = lineas.map((l) => ({ tipo: l.tipo, id: l.id, cantidad: aNumero(l.cantidad) }));
    if (partidas.some((p) => !(p.cantidad > 0))) return toast.error("Cada cantidad debe ser mayor que cero.");
    iniciar(async () => {
      const r = await guardarTraspaso({ origenId, destinoId, notas: notas || null, partidas });
      if (!r.ok) return void toast.error(r.mensaje);
      toast.success(`Traspaso ${r.folio} registrado.`);
      router.push("/almacen/traspasos");
    });
  }

  return (
    <Card className="max-w-3xl">
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Sale de"
            nombre="origen"
            value={origenId}
            onChange={(e) => {
              setOrigenId(e.target.value);
              setLineas([]);
            }}
          >
            {origenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Llega a" nombre="destino" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
            <option value="">Elige…</option>
            {destinos
              .filter((s) => s.id !== origenId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
          </Selector>
        </div>
        <SelectorArticulos articulos={articulos} lineas={lineas} onChange={setLineas} conCosto={false} etiquetaExistencia="Hay" />
        {excedidos.length > 0 && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
            Mandas más de lo que el sistema tiene en el origen. Si es correcto, después ajusta el conteo de esa sucursal.
          </p>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="notas-traspaso">Notas</Label>
          <Textarea id="notas-traspaso" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Quién lo lleva, para qué pedido…" />
        </div>
        <Button type="button" size="lg" onClick={guardar} disabled={guardando || !lineas.length}>
          {guardando ? "Guardando…" : "Registrar traspaso"}
        </Button>
      </CardContent>
    </Card>
  );
}
