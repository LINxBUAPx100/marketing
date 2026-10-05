import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoCxP } from "@/components/estado-cxp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { ETIQUETA_METODO } from "@/lib/caja/resumen";
import { formatoCantidad, formatoCostoUnitario, formatoFecha, formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { DialogoCancelarCompra, DialogoPagar } from "./dialogos";

export const metadata: Metadata = { title: "Compra" };

export default async function PaginaCompra({ params }: PageProps<"/cuentas-por-pagar/compras/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("cxp.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [fila] = await db
    .select({ compra: t.compra, proveedor: t.proveedor, sucursal: t.sucursal.nombre, usuario: t.usuario.nombre })
    .from(t.compra)
    .innerJoin(t.proveedor, eq(t.proveedor.id, t.compra.proveedorId))
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.compra.sucursalId))
    .innerJoin(t.usuario, eq(t.usuario.id, t.compra.usuarioId))
    .where(and(eq(t.compra.id, id), eq(t.compra.negocioId, sesion.negocio.id)));
  if (!fila || !sesion.sucursales.some((s) => s.id === fila.compra.sucursalId)) notFound();

  const [partidas, pagos] = await Promise.all([
    db
      .select({ partida: t.compraPartida, insumo: t.insumo.nombre, insumoUnidad: t.insumo.unidad, producto: t.producto.nombre, productoUnidad: t.producto.unidad })
      .from(t.compraPartida)
      .leftJoin(t.insumo, eq(t.insumo.id, t.compraPartida.insumoId))
      .leftJoin(t.producto, eq(t.producto.id, t.compraPartida.productoId))
      .where(eq(t.compraPartida.compraId, id)),
    db
      .select({ pago: t.pagoProveedor, usuario: t.usuario.nombre })
      .from(t.pagoProveedor)
      .innerJoin(t.usuario, eq(t.usuario.id, t.pagoProveedor.usuarioId))
      .where(eq(t.pagoProveedor.compraId, id))
      .orderBy(asc(t.pagoProveedor.creadoEn)),
  ]);

  const { compra: c, proveedor } = fila;
  const saldo = c.estado === "activa" ? c.total - c.pagado : 0;

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/cuentas-por-pagar" />}>
        <ArrowLeft /> Cuentas por pagar
      </Button>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{proveedor.nombre}</h1>
            <EstadoCxP compra={c} />
          </div>
          <p className="text-muted-foreground text-sm">
            {c.referencia ? `Factura ${c.referencia} · ` : ""}
            {formatoFecha(c.fecha)} · Entró a {fila.sucursal} · Registró {fila.usuario}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.estado === "activa" && c.pagado === 0 && sesion.puede("cxp.crear") && <DialogoCancelarCompra compraId={c.id} />}
          {saldo > 0 && sesion.puede("cxp.pagar") && <DialogoPagar compraId={c.id} saldo={saldo} sucursal={sesion.sucursal?.nombre ?? null} />}
        </div>
      </div>
      {c.estado === "cancelada" && <p className="border-destructive/40 bg-destructive/5 mb-6 rounded-lg border px-4 py-3 text-sm">Cancelada: {c.motivoCancelacion}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Costo</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partidas.map(({ partida: p, insumo, insumoUnidad, producto, productoUnidad }) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.insumoId ? (
                        <Link href={`/insumos/${p.insumoId}`} className="font-medium hover:underline">
                          {insumo}
                        </Link>
                      ) : (
                        <Link href={`/productos/${p.productoId}`} className="font-medium hover:underline">
                          {producto}
                        </Link>
                      )}
                      <span className="text-muted-foreground block text-xs">{p.insumoId ? "Insumo" : "Producto"}</span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {formatoCantidad(p.cantidad)} <span className="text-muted-foreground text-xs">{insumoUnidad ?? productoUnidad}</span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatoCostoUnitario(p.costoUnitario)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(p.importe)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="py-0">
            <CardHeader className="pt-4">
              <CardTitle>Pagos</CardTitle>
            </CardHeader>
            <Table>
              <TableBody>
                {pagos.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground py-6 text-center">Sin pagos todavía.</TableCell>
                  </TableRow>
                )}
                {pagos.map(({ pago: p, usuario }) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatoFechaHora(p.creadoEn)}</TableCell>
                    <TableCell>
                      {ETIQUETA_METODO[p.metodo]}
                      <span className="text-muted-foreground block text-xs">
                        {[p.referencia, usuario, p.movimientoCajaId ? "salió de caja" : null].filter(Boolean).join(" · ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(p.monto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <Card className="content-start">
          <CardHeader>
            <CardTitle>Saldo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm tabular-nums">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span>{formatoMoneda(c.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pagado</span>
              <span>{formatoMoneda(c.pagado)}</span>
            </div>
            <div className={`flex justify-between border-t pt-2 text-base font-semibold ${saldo > 0 ? "text-destructive" : ""}`}>
              <span>Saldo</span>
              <span>{formatoMoneda(saldo)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vence</span>
              <span>{formatoFecha(c.vencimiento)}</span>
            </div>
            {proveedor.telefono && <span className="text-muted-foreground mt-2">Tel. {proveedor.telefono}</span>}
            {c.notas && <p className="text-muted-foreground border-t pt-2 font-sans whitespace-pre-line">{c.notas}</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
