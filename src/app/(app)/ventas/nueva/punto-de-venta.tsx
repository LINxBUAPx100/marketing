"use client";

import { Factory } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EditorPagos, nuevoPago, pagosParaEnviar, resumenPagos, type PagoEditable } from "@/components/ventas/editor-pagos";
import { Catalogo, ListaPartidas, ResumenTotales, usePartidas, type PartidaInicial, type ProductoCatalogo } from "@/components/ventas/partidas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import type { ConfigIva } from "@/lib/ventas/calculo";
import { registrarVenta, type VentaNueva } from "../acciones";
import { esErrorDeRed, guardarPendiente } from "@/lib/offline/cola";
import { useReglasCliente, type InfoCliente } from "@/components/ventas/use-reglas-cliente";
import { InfoCredito } from "@/components/ventas/info-credito";
import { SelectorCliente, type ClienteVenta } from "./selector-cliente";

type Props = {
  sucursal: string;
  sucursalId: string;
  productos: ProductoCatalogo[];
  categorias: { id: string; nombre: string }[];
  clienteInicial: ClienteVenta | null;
  infoInicial: InfoCliente | null;
  iva: ConfigIva;
  puedeDescontar: boolean;
  puedeCrearCliente: boolean;
  /** Cuando la venta nace de una cotización. */
  cotizacion: { id: string; folio: string; partidas: PartidaInicial[]; notas: string | null } | null;
};

export function PuntoDeVenta(props: Props) {
  // Al guardar una venta sin conexión se vuelve a montar el punto de venta para empezar otra en limpio.
  const [n, setN] = useState(0);
  return <PuntoDeVentaInterno key={n} {...props} alGuardarSinConexion={() => setN((x) => x + 1)} />;
}

function PuntoDeVentaInterno({
  sucursal,
  sucursalId,
  productos,
  categorias,
  clienteInicial,
  infoInicial,
  iva,
  puedeDescontar,
  puedeCrearCliente,
  cotizacion,
  alGuardarSinConexion,
}: Props & { alGuardarSinConexion: () => void }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const { cliente, setCliente, info } = useReglasCliente(clienteInicial, infoInicial);
  const [pagos, setPagos] = useState<PagoEditable[]>([]);
  const [entrega, setEntrega] = useState("");
  const [notas, setNotas] = useState(cotizacion?.notas ?? "");
  // null = seguir la sugerencia según los productos; true/false = lo eligió la persona.
  const [produccionElegida, setProduccionElegida] = useState<boolean | null>(null);

  const partidas = usePartidas({ productos, reglas: info.reglas, iva, iniciales: cotizacion?.partidas });
  const { totales } = partidas;
  const pagosResumen = resumenPagos(pagos, totales.total);
  const hayErrores = partidas.hayErrores || pagosResumen.invalido || pagosResumen.excedido;
  const faltaCliente = pagosResumen.saldo > 0 && !cliente;
  const enviarProduccion = produccionElegida ?? partidas.sugiereProduccion;

  function registrar() {
    if (!partidas.lineas.length) return toast.error("Agrega al menos un producto.");
    if (hayErrores) return toast.error("Corrige lo que está marcado en rojo.");
    if (faltaCliente) return toast.error("Para dejar saldo pendiente, elige el cliente.");

    const entrada: VentaNueva = {
      clienteId: cliente?.id ?? null,
      fechaEntrega: entrega || null,
      notas: notas || null,
      partidas: partidas.paraEnviar(),
      pagos: pagosParaEnviar(pagos),
      enviarProduccion,
      cotizacionId: cotizacion?.id ?? null,
      claveLocal: crypto.randomUUID(),
      sucursalId,
    };

    iniciar(async () => {
      let resultado: Awaited<ReturnType<typeof registrarVenta>>;
      try {
        if (!navigator.onLine) throw new TypeError("Sin conexión");
        resultado = await registrarVenta(entrada);
      } catch (e) {
        if (!esErrorDeRed(e)) {
          toast.error("No se pudo registrar la venta. Intenta de nuevo.");
          return;
        }
        // Sin internet: se guarda en este equipo y se manda sola al volver la conexión.
        await guardarPendiente({
          clave: entrada.claveLocal!,
          capturadaEn: new Date().toISOString(),
          sucursal,
          cliente: cliente?.nombre ?? null,
          total: totales.total,
          datos: { ...entrada, notas: [entrada.notas, `Capturada sin conexión el ${formatoFechaHora(new Date())}`].filter(Boolean).join(" ") },
        });
        toast.warning("Sin conexión: la venta quedó guardada en este equipo y se enviará sola al volver el internet.");
        alGuardarSinConexion();
        return;
      }
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(`Venta ${resultado.folio} registrada${enviarProduccion ? " y enviada a producción" : ""}.`);
      router.push(`/ventas/${resultado.id}`);
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <section className="grid min-w-0 gap-3" aria-label="Catálogo">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{cotizacion ? `Venta de la cotización ${cotizacion.folio}` : "Nueva venta"}</h1>
          <span className="text-muted-foreground text-sm">{sucursal}</span>
        </div>
        <Catalogo productos={productos} categorias={categorias} precioLista={partidas.precioLista} onAgregar={partidas.agregar} onLibre={partidas.agregarLibre} />
      </section>

      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Venta</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {cotizacion && cliente ? (
            <p className="rounded-lg border px-3 py-2 text-sm">
              <span className="font-medium">{cliente.nombre}</span>
              <span className="text-muted-foreground block text-xs">Cliente de la cotización</span>
            </p>
          ) : (
            <SelectorCliente cliente={cliente} onChange={setCliente} puedeCrear={puedeCrearCliente} />
          )}
          {cliente && <InfoCredito info={info} saldoNuevo={Math.max(0, pagosResumen.saldo)} />}

          <ListaPartidas partidas={partidas} puedeDescontar={puedeDescontar} />
          <ResumenTotales totales={totales} ivaBp={iva.ivaBp} />

          <div className="grid gap-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cobro</span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0" disabled={!totales.total} onClick={() => setPagos([nuevoPago("efectivo", totales.total)])}>
                Pago completo en efectivo
              </Button>
            </div>
            <EditorPagos pagos={pagos} onChange={setPagos} porCobrar={totales.total} />
            {faltaCliente && <p className="text-destructive text-xs">Para dejar saldo pendiente, elige el cliente arriba.</p>}
          </div>

          <div className="grid gap-3 border-t pt-3">
            <label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-primary/5">
              <input
                type="checkbox"
                checked={enviarProduccion}
                onChange={(e) => setProduccionElegida(e.target.checked)}
                className="accent-primary mt-0.5 size-4"
              />
              <span className="grid gap-0.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <Factory className="size-4" /> Enviar a producción
                </span>
                <span className="text-muted-foreground text-xs">Crea la orden de trabajo para el taller con la fecha de entrega.</span>
              </span>
            </label>
            <div className="grid gap-1.5">
              <Label htmlFor="entrega">Fecha y hora de entrega</Label>
              <Input id="entrega" type="datetime-local" value={entrega} onChange={(e) => setEntrega(e.target.value)} />
              {enviarProduccion && !entrega && <p className="text-xs text-amber-700">Sin fecha, la orden no podrá marcarse como atrasada.</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notas-venta">Notas de la venta</Label>
              <Textarea id="notas-venta" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Se entrega en sucursal, factura pendiente…" />
            </div>
          </div>

          <Button type="button" size="lg" className="h-11 text-base" disabled={enviando || !partidas.lineas.length} onClick={registrar}>
            {enviando ? "Registrando…" : `Registrar venta · ${formatoMoneda(totales.total)}`}
          </Button>
          {info.reglas.tipoPrecio === "revendedor" && !info.reglas.convenio && !cotizacion && <Badge className="justify-self-center">Precios de revendedor aplicados</Badge>}
        </CardContent>
      </Card>
    </div>
  );
}
