import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, Pencil, Printer, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoCotizacion } from "@/components/estado-cotizacion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoCantidad, formatoFecha, formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { usuariosActivos } from "@/lib/produccion/consultas";
import { estadoCotizacion } from "@/lib/produccion/reglas";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { whatsappConfigurado } from "@/lib/mensajes/proveedor";
import { BotonWhatsApp } from "@/components/boton-whatsapp";
import { DialogoCerrar, DialogoCompletar, DialogoSeguimiento } from "./dialogos";

export const metadata: Metadata = { title: "Cotización" };

/** Mañana a las 10:00 en México, para sugerir el seguimiento. */
const mananaDiez = () => {
  const manana = new Date(Date.now() + 86_400_000);
  return `${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(manana)}T10:00`;
};

export default async function PaginaCotizacion({ params }: PageProps<"/cotizaciones/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("cotizaciones.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [fila] = await db
    .select({ cotizacion: t.cotizacion, cliente: t.cliente, vendedor: t.usuario.nombre, sucursal: t.sucursal.nombre })
    .from(t.cotizacion)
    .innerJoin(t.cliente, eq(t.cliente.id, t.cotizacion.clienteId))
    .innerJoin(t.usuario, eq(t.usuario.id, t.cotizacion.usuarioId))
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.cotizacion.sucursalId))
    .where(and(eq(t.cotizacion.id, id), eq(t.cotizacion.negocioId, sesion.negocio.id)));
  if (!fila || !sesion.sucursales.some((s) => s.id === fila.cotizacion.sucursalId)) notFound();

  const [partidas, seguimientos, usuarios, venta] = await Promise.all([
    db.select().from(t.cotizacionPartida).where(eq(t.cotizacionPartida.cotizacionId, id)).orderBy(asc(t.cotizacionPartida.orden)),
    db
      .select({ seguimiento: t.seguimiento, usuario: t.usuario.nombre })
      .from(t.seguimiento)
      .innerJoin(t.usuario, eq(t.usuario.id, t.seguimiento.usuarioId))
      .where(eq(t.seguimiento.cotizacionId, id))
      .orderBy(asc(t.seguimiento.fecha)),
    usuariosActivos(sesion.negocio.id),
    fila.cotizacion.ventaId ? db.select({ id: t.venta.id, folio: t.venta.folio }).from(t.venta).where(eq(t.venta.id, fila.cotizacion.ventaId)) : Promise.resolve([]),
  ]);

  const { cotizacion: c, cliente } = fila;
  const estado = estadoCotizacion(c);
  const abierta = c.estado === "abierta";
  const ahora = new Date();

  const mensaje = [
    `Hola ${cliente.nombre.split(" ")[0]}, te comparto la cotización ${c.folio} de ${sesion.negocio.nombre}:`,
    ...partidas.map((p) => `• ${formatoCantidad(p.cantidad)} ${p.unidad} ${p.descripcion}: ${formatoMoneda(p.importe)}`),
    `Total: ${formatoMoneda(c.total)} (IVA incluido)`,
    `Válida hasta el ${formatoFecha(c.vigenciaHasta)}.`,
  ].join("\n");
  const whatsapp = enlaceWhatsApp(cliente.telefono, mensaje);

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/cotizaciones" />}>
        <ArrowLeft /> Cotizaciones
      </Button>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{c.folio}</h1>
            <EstadoCotizacion cotizacion={c} />
          </div>
          <p className="text-muted-foreground text-sm">
            {formatoFechaHora(c.creadoEn)} · {fila.sucursal} · Cotizó {fila.vendedor}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href={`/imprimir/cotizacion/${c.id}`} target="_blank" />}>
            <Printer /> Imprimir
          </Button>
          <BotonWhatsApp api={whatsappConfigurado()} clave="cotizacion_enviada" entidadId={c.id} enlace={whatsapp} />
          {abierta && sesion.puede("cotizaciones.editar") && (
            <Button variant="outline" nativeButton={false} render={<Link href={`/cotizaciones/${c.id}/editar`} />}>
              <Pencil /> Editar
            </Button>
          )}
          {abierta && sesion.puede("cotizaciones.cancelar") && (
            <>
              <DialogoCerrar id={c.id} estado="rechazada" />
              <DialogoCerrar id={c.id} estado="cancelada" />
            </>
          )}
          {abierta && sesion.puede("ventas.crear") && (
            <Button nativeButton={false} render={<Link href={`/ventas/nueva?cotizacion=${c.id}`} />}>
              <ShoppingCart /> Convertir en venta
            </Button>
          )}
        </div>
      </div>

      {estado === "vencida" && (
        <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          Venció el {formatoFecha(c.vigenciaHasta)}. Si la conviertes en venta, los precios se revisan contra la lista actual. Puedes editarla para extender la vigencia.
        </p>
      )}
      {venta[0] && (
        <p className="mb-6 rounded-lg border px-4 py-3 text-sm">
          Se vendió en{" "}
          <Link href={`/ventas/${venta[0].id}`} className="text-primary font-mono font-medium hover:underline">
            {venta[0].folio}
          </Link>
          .
        </p>
      )}
      {c.motivoRechazo && <p className="text-muted-foreground mb-6 rounded-lg border px-4 py-3 text-sm">Motivo: {c.motivoRechazo}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
                {[
                  ["Subtotal", c.subtotal],
                  [`IVA ${sesion.negocio.ivaBp / 100}%`, c.iva],
                  ["Total", c.total],
                ].map(([etiqueta, valor], i) => (
                  <TableRow key={etiqueta} className={i === 2 ? "text-base font-semibold" : "font-normal"}>
                    <TableCell colSpan={4} className="text-right tabular-nums">
                      <span className="text-muted-foreground mr-3 font-normal">{etiqueta}</span>
                      {formatoMoneda(valor as number)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableFooter>
            </Table>
          </Card>
          {(c.notas || c.condiciones) && (
            <Card>
              <CardContent className="grid gap-3 text-sm">
                {c.notas && <p className="whitespace-pre-line">{c.notas}</p>}
                {c.condiciones && <p className="text-muted-foreground text-xs whitespace-pre-line">{c.condiciones}</p>}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm">
              <Link href={`/clientes/${cliente.id}`} className="font-medium hover:underline">
                {cliente.nombre}
              </Link>
              {cliente.empresa && <span className="text-muted-foreground">{cliente.empresa}</span>}
              {cliente.telefono && <span className="text-muted-foreground">{cliente.telefono}</span>}
              <span className="text-muted-foreground mt-2">Válida hasta {formatoFecha(c.vigenciaHasta)}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Seguimientos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {seguimientos.length === 0 && <p className="text-muted-foreground text-sm">Sin seguimientos. Programa uno para no olvidar al cliente.</p>}
              <ul className="grid gap-3">
                {seguimientos.map(({ seguimiento: s, usuario }) => {
                  const vencido = !s.hechoEn && s.fecha <= ahora;
                  return (
                    <li key={s.id} className={`grid gap-1 rounded-lg border p-2.5 text-sm ${vencido ? "border-destructive/50 bg-destructive/5" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className={s.hechoEn ? "text-muted-foreground line-through" : "font-medium"}>{s.nota}</span>
                        {!s.hechoEn && <DialogoCompletar id={s.id} />}
                      </div>
                      <span className={`text-xs ${vencido ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {formatoFechaHora(s.fecha)} · {usuario}
                      </span>
                      {s.resultado && <span className="text-xs">Resultado: {s.resultado}</span>}
                    </li>
                  );
                })}
              </ul>
              {abierta && <DialogoSeguimiento cotizacionId={c.id} usuarios={usuarios} usuarioActual={sesion.usuario.id} sugerencia={mananaDiez()} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
