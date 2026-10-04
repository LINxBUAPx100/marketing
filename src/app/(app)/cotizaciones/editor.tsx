"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Catalogo, ListaPartidas, ResumenTotales, usePartidas, type PartidaInicial, type ProductoCatalogo } from "@/components/ventas/partidas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatoMoneda } from "@/lib/numeros";
import type { ConfigIva } from "@/lib/ventas/calculo";
import { InfoCredito } from "@/components/ventas/info-credito";
import { useReglasCliente, type InfoCliente } from "@/components/ventas/use-reglas-cliente";
import { SelectorCliente, type ClienteVenta } from "../ventas/nueva/selector-cliente";
import { guardar } from "./acciones";

type Props = {
  productos: ProductoCatalogo[];
  categorias: { id: string; nombre: string }[];
  iva: ConfigIva;
  puedeDescontar: boolean;
  puedeCrearCliente: boolean;
  inicial: {
    id: string | null;
    folio: string | null;
    cliente: ClienteVenta | null;
    infoCliente: InfoCliente | null;
    vigenciaHasta: string;
    notas: string;
    condiciones: string;
    partidas: PartidaInicial[];
  };
};

export function EditorCotizacion({ productos, categorias, iva, puedeDescontar, puedeCrearCliente, inicial }: Props) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const { cliente, setCliente, info } = useReglasCliente(inicial.cliente, inicial.infoCliente);
  const [vigencia, setVigencia] = useState(inicial.vigenciaHasta);
  const [notas, setNotas] = useState(inicial.notas);
  const [condiciones, setCondiciones] = useState(inicial.condiciones);
  const partidas = usePartidas({ productos, reglas: info.reglas, iva, iniciales: inicial.partidas });

  function enviar() {
    if (!cliente) return toast.error("Elige a qué cliente va la cotización.");
    if (!partidas.lineas.length) return toast.error("Agrega al menos un producto.");
    if (partidas.hayErrores) return toast.error("Corrige lo que está marcado en rojo.");
    if (!vigencia) return toast.error("Elige hasta cuándo es válida.");
    iniciar(async () => {
      const r = await guardar({
        id: inicial.id,
        clienteId: cliente.id,
        vigenciaHasta: vigencia,
        notas: notas || null,
        condiciones: condiciones || null,
        partidas: partidas.paraEnviar(),
      });
      if (!r.ok) return void toast.error(r.mensaje);
      toast.success(inicial.id ? "Cotización actualizada." : `Cotización ${r.folio} creada.`);
      router.push(`/cotizaciones/${r.id}`);
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <section className="grid min-w-0 gap-3" aria-label="Catálogo">
        <h1 className="text-2xl font-semibold tracking-tight">{inicial.folio ? `Editar cotización ${inicial.folio}` : "Nueva cotización"}</h1>
        <Catalogo productos={productos} categorias={categorias} precioLista={partidas.precioLista} onAgregar={partidas.agregar} onLibre={partidas.agregarLibre} />
      </section>

      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Cotización</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SelectorCliente cliente={cliente} onChange={setCliente} puedeCrear={puedeCrearCliente} />
          {cliente && <InfoCredito info={info} saldoNuevo={0} />}
          <ListaPartidas partidas={partidas} puedeDescontar={puedeDescontar} />
          <ResumenTotales totales={partidas.totales} ivaBp={iva.ivaBp} />
          <div className="grid gap-3 border-t pt-3">
            <div className="grid gap-1.5">
              <Label htmlFor="vigencia">Válida hasta</Label>
              <Input id="vigencia" type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notas-cotizacion">Notas para el cliente</Label>
              <Textarea id="notas-cotizacion" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Tiempo de entrega estimado, opciones…" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="condiciones">Condiciones</Label>
              <Textarea id="condiciones" rows={3} value={condiciones} onChange={(e) => setCondiciones(e.target.value)} />
            </div>
          </div>
          <Button type="button" size="lg" className="h-11 text-base" disabled={guardando || !partidas.lineas.length} onClick={enviar}>
            {guardando ? "Guardando…" : `Guardar cotización · ${formatoMoneda(partidas.totales.total)}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
