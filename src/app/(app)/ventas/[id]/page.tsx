import { ArrowLeft, Factory, FileCheck2, MessageCircle, Printer, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { estadoPago } from "@/components/tabla-ventas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ingresoSinIva, utilidad } from "@/lib/almacen/reglas";
import { DialogoFacturar } from "@/components/facturacion/dialogo-facturar";
import { requerirPermiso } from "@/lib/auth";
import { datosParaFacturar, facturaDeVenta } from "@/lib/facturacion/consultas";
import { ETIQUETA_METODO } from "@/lib/caja/resumen";
import { formatoCantidad, formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { obtenerVenta } from "@/lib/ventas/consultas";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { DialogoAbono } from "./dialogo-abono";
import { DialogoCancelar } from "./dialogo-cancelar";

export const metadata: Metadata = { title: "Venta" };

export default async function PaginaVenta({ params }: PageProps<"/ventas/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("ventas.ver");
  const datos = await obtenerVenta(sesion, id);
  if (!datos) notFound();
  const { venta, cliente, sucursal, partidas, pagos, saldo } = datos;
  const factura = await facturaDeVenta(venta.id);
  const paraFacturar =
    !factura && venta.estado === "activa" && cliente && sesion.puede("facturacion.timbrar") ? await datosParaFacturar(sesion, [venta.id]) : null;
  const estado = estadoPago(venta);
  // Utilidad: sobre la base sin IVA y solo si todas las partidas tienen costo.
  const costoTotal = partidas.every((p) => p.costo != null) ? partidas.reduce((s, p) => s + (p.costo ?? 0), 0) : null;
  const ganancia = utilidad(ingresoSinIva(venta.total, sesion.negocio), costoTotal);

  const mensaje = [
    `Hola ${cliente?.nombre.split(" ")[0] ?? ""}, gracias por tu compra en ${sesion.negocio.nombre}.`,
    `Nota ${venta.folio}: total ${formatoMoneda(venta.total)}, pagado ${formatoMoneda(venta.pagado)}${saldo > 0 ? `, saldo ${formatoMoneda(saldo)}` : ""}.`,
    venta.fechaEntrega ? `Entrega: ${formatoFechaHora(venta.fechaEntrega)}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const whatsapp = enlaceWhatsApp(cliente?.telefono, mensaje);

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/ventas" />}>
        <ArrowLeft /> Ventas
      </Button>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{venta.folio}</h1>
            <Badge variant={estado.variante}>{estado.texto}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {formatoFechaHora(venta.creadoEn)} · {sucursal.nombre} · Vendió {datos.vendedor}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {datos.orden && sesion.puede("produccion.ver") && (
            <Button variant="outline" nativeButton={false} render={<Link href={`/produccion/${datos.orden.id}`} />}>
              <Factory /> {datos.orden.estado === "activa" ? datos.orden.etapa : datos.orden.estado === "entregada" ? "Entregada" : "Orden cancelada"}
            </Button>
          )}
          {factura && sesion.puede("facturacion.ver") && (
            <Button variant="outline" nativeButton={false} render={<Link href={`/facturacion/${factura.id}`} />}>
              <FileCheck2 /> {factura.global ? "En factura global" : `Factura ${factura.serie}-${factura.folio}`}
            </Button>
          )}
          {paraFacturar && <DialogoFacturar datos={paraFacturar} />}
          <Button variant="outline" nativeButton={false} render={<Link href={`/imprimir/venta/${venta.id}`} target="_blank" />}>
            <Printer /> Nota
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href={`/imprimir/venta/${venta.id}?formato=ticket`} target="_blank" />}>
            <ReceiptText /> Ticket
          </Button>
          {whatsapp && (
            <Button variant="outline" nativeButton={false} render={<a href={whatsapp} target="_blank" rel="noopener noreferrer" />}>
              <MessageCircle /> WhatsApp
            </Button>
          )}
          {venta.estado === "activa" && sesion.puede("ventas.cancelar") && <DialogoCancelar ventaId={venta.id} folio={venta.folio} pagado={venta.pagado} />}
          {saldo > 0 && (sesion.puede("cxc.abonar") || sesion.puede("ventas.crear")) && <DialogoAbono ventaId={venta.id} saldo={saldo} />}
        </div>
      </div>

      {venta.estado === "cancelada" && (
        <div className="border-destructive/40 bg-destructive/5 mb-6 rounded-lg border px-4 py-3 text-sm">
          <p className="text-destructive font-medium">
            Cancelada el {formatoFechaHora(venta.canceladaEn)} por {datos.canceladaPor}
          </p>
          <p className="text-muted-foreground">Motivo: {venta.motivoCancelacion}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Precio</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partidas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-normal">
                      <span className="font-medium">{p.descripcion}</span>
                      {p.notas && <span className="text-muted-foreground block text-xs whitespace-pre-line">{p.notas}</span>}
                      {p.descuento > 0 && <span className="block text-xs text-emerald-700">Descuento {formatoMoneda(p.descuento)}</span>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {formatoCantidad(p.cantidad)} <span className="text-muted-foreground text-xs">{p.unidad}</span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatoMoneda(p.precioUnitario)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(p.importe)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <Fila etiqueta="Subtotal" valor={venta.subtotal} />
                <Fila etiqueta={`IVA ${sesion.negocio.ivaBp / 100}%`} valor={venta.iva} />
                <Fila etiqueta="Total" valor={venta.total} fuerte />
              </TableFooter>
            </Table>
          </Card>

          <Card className="py-0">
            <CardHeader className="pt-4">
              <CardTitle>Pagos</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="hidden sm:table-cell">Recibió</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                      Sin pagos registrados.
                    </TableCell>
                  </TableRow>
                )}
                {pagos.map((p) => (
                  <TableRow key={p.id} className={p.cancelado ? "line-through opacity-55" : undefined}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatoFechaHora(p.creadoEn)}</TableCell>
                    <TableCell>
                      {ETIQUETA_METODO[p.metodo]}
                      {p.referencia && <span className="text-muted-foreground block text-xs">{p.referencia}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      {p.usuario} · {p.sucursal}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(p.monto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Saldo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Linea etiqueta="Total" valor={formatoMoneda(venta.total)} />
              <Linea etiqueta="Pagado" valor={formatoMoneda(venta.pagado)} />
              <div className={`flex justify-between border-t pt-2 text-base font-semibold ${saldo > 0 ? "text-destructive" : ""}`}>
                <span>Saldo</span>
                <span className="tabular-nums">{formatoMoneda(saldo)}</span>
              </div>
            </CardContent>
          </Card>
          {sesion.puede("productos.costos") && venta.estado === "activa" && (
            <Card>
              <CardHeader>
                <CardTitle>Utilidad</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {costoTotal == null ? (
                  <p className="text-muted-foreground">Alguna partida no tiene costo (sin receta ni costo capturado).</p>
                ) : (
                  <>
                    <Linea etiqueta="Venta sin IVA" valor={formatoMoneda(ingresoSinIva(venta.total, sesion.negocio))} />
                    <Linea etiqueta="Costo" valor={formatoMoneda(costoTotal)} />
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>Utilidad</span>
                      <span className="tabular-nums">
                        {formatoMoneda(ganancia.utilidad ?? 0)}
                        {ganancia.margen != null && <span className="text-muted-foreground ml-1 font-normal">({Math.round(ganancia.margen * 100)} %)</span>}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Cliente y entrega</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {cliente ? (
                <Link href={`/clientes/${cliente.id}`} className="font-medium hover:underline">
                  {cliente.nombre}
                </Link>
              ) : (
                <span className="text-muted-foreground">Público en general</span>
              )}
              {cliente?.telefono && <span className="text-muted-foreground">{cliente.telefono}</span>}
              <Linea etiqueta="Entrega" valor={venta.fechaEntrega ? formatoFechaHora(venta.fechaEntrega) : "Sin fecha"} />
              {venta.notas && <p className="text-muted-foreground border-t pt-2 whitespace-pre-line">{venta.notas}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Fila({ etiqueta, valor, fuerte }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <TableRow className={fuerte ? "text-base font-semibold" : "font-normal"}>
      <TableCell colSpan={2} className="sm:hidden" />
      <TableCell colSpan={3} className="hidden sm:table-cell" />
      <TableCell className="text-right whitespace-nowrap tabular-nums">
        <span className="text-muted-foreground mr-3 font-normal">{etiqueta}</span>
        {formatoMoneda(valor)}
      </TableCell>
    </TableRow>
  );
}

function Linea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="text-right tabular-nums">{valor}</span>
    </div>
  );
}
