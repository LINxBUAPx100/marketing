import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ArrowLeft, FileCode2, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { ETIQUETA_METODO } from "@/lib/caja/resumen";
import type { ConceptoCfdi, DocumentoPagado, ReceptorCfdi } from "@/lib/facturacion/pac";
import { ETIQUETA_FORMA_PAGO, MOTIVOS_CANCELACION } from "@/lib/facturacion/reglas";
import { pagosSinComplemento } from "@/lib/facturacion/servidor";
import { formatoCantidad, formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { whatsappConfigurado } from "@/lib/mensajes/proveedor";
import { BotonWhatsApp } from "@/components/boton-whatsapp";
import { BotonComplemento, DialogoCancelarFactura } from "./controles";

export const metadata: Metadata = { title: "Factura" };

export default async function PaginaFactura({ params }: PageProps<"/facturacion/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("facturacion.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [fila] = await db
    .select({ factura: t.factura, telefono: t.cliente.telefono, usuario: t.usuario.nombre })
    .from(t.factura)
    .leftJoin(t.cliente, eq(t.cliente.id, t.factura.clienteId))
    .innerJoin(t.usuario, eq(t.usuario.id, t.factura.usuarioId))
    .where(and(eq(t.factura.id, id), eq(t.factura.negocioId, sesion.negocio.id)));
  if (!fila || !sesion.sucursales.some((s) => s.id === fila.factura.sucursalId)) notFound();
  const f = fila.factura;
  const receptor = f.receptor as ReceptorCfdi;

  const comprobante = alias(t.factura, "comprobante");
  const [ventas, complementos, pendientes, relacionada] = await Promise.all([
    db
      .select({ id: t.venta.id, folio: t.venta.folio, total: t.venta.total, pagado: t.venta.pagado })
      .from(t.facturaVenta)
      .innerJoin(t.venta, eq(t.venta.id, t.facturaVenta.ventaId))
      .where(eq(t.facturaVenta.facturaId, id))
      .orderBy(asc(t.venta.creadoEn)),
    db
      .select({ complemento: t.complementoPago, id: comprobante.id, serie: comprobante.serie, folio: comprobante.folio, estado: comprobante.estado, creadoEn: comprobante.creadoEn })
      .from(t.complementoPago)
      .innerJoin(comprobante, eq(comprobante.id, t.complementoPago.comprobanteId))
      .where(eq(t.complementoPago.facturaId, id))
      .orderBy(asc(t.complementoPago.parcialidad)),
    f.tipo === "I" && f.metodoPago === "PPD" && f.estado === "vigente" ? pagosSinComplemento(id) : Promise.resolve([]),
    // Para un complemento: la factura que ampara.
    f.tipo === "P"
      ? db
          .select({ id: t.factura.id, serie: t.factura.serie, folio: t.factura.folio })
          .from(t.complementoPago)
          .innerJoin(t.factura, eq(t.factura.id, t.complementoPago.facturaId))
          .where(eq(t.complementoPago.comprobanteId, id))
      : Promise.resolve([]),
  ]);

  const folio = `${f.serie}-${f.folio}`;
  const whatsapp = enlaceWhatsApp(fila.telefono, `Hola, te compartimos la factura ${folio} de ${sesion.negocio.nombre} por ${formatoMoneda(f.total)}. UUID: ${f.uuid}`);
  const motivo = MOTIVOS_CANCELACION.find(([c]) => c === f.motivoCancelacion)?.[1];

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/facturacion" />}>
        <ArrowLeft /> Facturación
      </Button>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{folio}</h1>
            <Badge variant={f.estado === "vigente" ? "secondary" : "outline"}>{f.estado === "vigente" ? "Vigente" : "Cancelada"}</Badge>
            {f.simulada && <Badge variant="destructive">Simulada · sin validez fiscal</Badge>}
          </div>
          <p className="text-muted-foreground text-sm">
            {f.tipo === "P" ? "Complemento de pago" : f.global ? "Factura global" : "Factura"} · {formatoFechaHora(f.creadoEn)} · {fila.usuario}
          </p>
          <p className="text-muted-foreground font-mono text-xs break-all">UUID {f.uuid}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<a href={`/facturacion/${f.id}/pdf`} target="_blank" rel="noopener" />}>
            <Printer /> PDF
          </Button>
          {f.xml && (
            <Button variant="outline" nativeButton={false} render={<a href={`/facturacion/${f.id}/xml`} download={`${folio}.xml`} />}>
              <FileCode2 /> XML
            </Button>
          )}
          {f.estado === "vigente" && <BotonWhatsApp api={whatsappConfigurado() && f.tipo === "I"} clave="factura_emitida" entidadId={f.id} enlace={whatsapp} />}
          {f.estado === "vigente" && sesion.puede("facturacion.cancelar") && <DialogoCancelarFactura id={f.id} folio={folio} />}
        </div>
      </div>

      {f.estado === "cancelada" && (
        <p className="border-destructive/40 bg-destructive/5 mb-6 rounded-lg border px-4 py-3 text-sm">
          Cancelada el {formatoFechaHora(f.canceladaEn)} · Motivo {f.motivoCancelacion}: {motivo}
          {f.sustituidaPor && ` · Sustituida por ${f.sustituidaPor}`}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          {f.tipo === "I" ? (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="hidden sm:table-cell">Claves SAT</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(f.conceptos as ConceptoCfdi[]).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-normal">
                        {c.descripcion}
                        {c.noIdentificacion && <span className="text-muted-foreground block font-mono text-xs">{c.noIdentificacion}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden font-mono text-xs sm:table-cell">
                        {c.claveProdServ} · {c.claveUnidad}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatoCantidad(c.cantidad)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(Math.round(c.cantidad * c.precioUnitario) - c.descuento)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Pago amparado</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                {(f.conceptos as DocumentoPagado[]).map((d) => (
                  <div key={d.uuid} className="grid gap-1">
                    <Linea etiqueta="Factura" valor={relacionada[0] ? `${relacionada[0].serie}-${relacionada[0].folio}` : d.uuid} />
                    <Linea etiqueta="Parcialidad" valor={String(d.parcialidad)} />
                    <Linea etiqueta="Saldo anterior" valor={formatoMoneda(d.saldoAnterior)} />
                    <Linea etiqueta="Pagado" valor={formatoMoneda(d.monto)} />
                    <Linea etiqueta="Forma de pago" valor={ETIQUETA_FORMA_PAGO[f.formaPago ?? ""] ?? f.formaPago ?? "—"} />
                  </div>
                ))}
                {relacionada[0] && (
                  <Link href={`/facturacion/${relacionada[0].id}`} className="text-primary mt-2 hover:underline">
                    Ver factura
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {f.tipo === "I" && f.metodoPago === "PPD" && (
            <Card>
              <CardHeader>
                <CardTitle>Complementos de pago</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {complementos.length === 0 && pendientes.length === 0 && <p className="text-muted-foreground">Aún no hay pagos después de facturar.</p>}
                {complementos.map(({ complemento: c, id: cid, serie, folio: fol, estado }) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span>
                      <Link href={`/facturacion/${cid}`} className="font-mono font-medium hover:underline">
                        {serie}-{fol}
                      </Link>
                      <span className="text-muted-foreground block text-xs">
                        Parcialidad {c.parcialidad} · saldo {formatoMoneda(c.saldoAnterior)} → {formatoMoneda(c.saldoInsoluto)}
                        {estado === "cancelada" && " · cancelado"}
                      </span>
                    </span>
                    <span className="font-medium tabular-nums">{formatoMoneda(c.monto)}</span>
                  </div>
                ))}
                {pendientes.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
                    <span>
                      Pago de {formatoMoneda(p.monto)} · {ETIQUETA_METODO[p.metodo]}
                      <span className="text-muted-foreground block text-xs">
                        {formatoFechaHora(p.creadoEn)} · {p.folio} · le falta complemento
                      </span>
                    </span>
                    {sesion.puede("facturacion.timbrar") && <BotonComplemento facturaId={f.id} pagoId={p.id} />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Receptor</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm">
              <p className="font-medium">{receptor.nombre}</p>
              <Linea etiqueta="RFC" valor={receptor.rfc} />
              <Linea etiqueta="Régimen" valor={receptor.regimen} />
              <Linea etiqueta="C.P." valor={receptor.codigoPostal} />
              <Linea etiqueta="Uso" valor={receptor.uso} />
            </CardContent>
          </Card>
          {f.tipo === "I" && (
            <Card>
              <CardHeader>
                <CardTitle>Importes</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <Linea etiqueta="Subtotal" valor={formatoMoneda(f.subtotal)} />
                <Linea etiqueta="IVA" valor={formatoMoneda(f.iva)} />
                <Linea etiqueta="Total" valor={formatoMoneda(f.total)} fuerte />
                <Linea etiqueta="Método" valor={f.metodoPago ?? "—"} />
                <Linea etiqueta="Forma" valor={ETIQUETA_FORMA_PAGO[f.formaPago ?? ""] ?? f.formaPago ?? "—"} />
                {ventas.length > 0 && (
                  <div className="mt-2 grid gap-1 border-t pt-2">
                    <span className="text-muted-foreground text-xs">Ventas que ampara ({ventas.length})</span>
                    {ventas.slice(0, 12).map((v) => (
                      <Link key={v.id} href={`/ventas/${v.id}`} className="flex justify-between font-mono text-xs hover:underline">
                        <span>{v.folio}</span>
                        <span>{formatoMoneda(v.total)}</span>
                      </Link>
                    ))}
                    {ventas.length > 12 && <span className="text-muted-foreground text-xs">y {ventas.length - 12} más</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Linea({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${fuerte ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="text-right tabular-nums">{valor}</span>
    </div>
  );
}
