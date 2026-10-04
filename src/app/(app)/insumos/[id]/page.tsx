import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { ETIQUETA_MOTIVO } from "@/lib/almacen/reglas";
import { requerirPermiso } from "@/lib/auth";
import { costoUnitarioATexto, formatoCantidad, formatoCostoUnitario, formatoFechaHora } from "@/lib/numeros";
import { DialogoAjusteInsumo } from "./dialogo-ajuste";
import { DialogoInsumo } from "../dialogo";

export const metadata: Metadata = { title: "Insumo" };

export default async function PaginaInsumo({ params }: PageProps<"/insumos/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("insumos.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const negocioId = sesion.negocio.id;
  const [insumo] = await db.select().from(t.insumo).where(and(eq(t.insumo.id, id), eq(t.insumo.negocioId, negocioId)));
  if (!insumo) notFound();

  const [sucursales, existencias, movimientos, usos] = await Promise.all([
    db.select({ id: t.sucursal.id, nombre: t.sucursal.nombre }).from(t.sucursal).where(and(eq(t.sucursal.negocioId, negocioId), eq(t.sucursal.activa, true))).orderBy(asc(t.sucursal.creadoEn)),
    db.select().from(t.existenciaInsumo).where(eq(t.existenciaInsumo.insumoId, id)),
    db
      .select({
        id: t.movimientoInsumo.id,
        cantidad: t.movimientoInsumo.cantidad,
        motivo: t.movimientoInsumo.motivo,
        nota: t.movimientoInsumo.nota,
        creadoEn: t.movimientoInsumo.creadoEn,
        ventaId: t.movimientoInsumo.ventaId,
        compraId: t.movimientoInsumo.compraId,
        sucursal: t.sucursal.nombre,
        usuario: t.usuario.nombre,
        folio: t.venta.folio,
      })
      .from(t.movimientoInsumo)
      .innerJoin(t.sucursal, eq(t.sucursal.id, t.movimientoInsumo.sucursalId))
      .leftJoin(t.usuario, eq(t.usuario.id, t.movimientoInsumo.usuarioId))
      .leftJoin(t.venta, eq(t.venta.id, t.movimientoInsumo.ventaId))
      .where(eq(t.movimientoInsumo.insumoId, id))
      .orderBy(desc(t.movimientoInsumo.creadoEn))
      .limit(40),
    db
      .select({ id: t.producto.id, nombre: t.producto.nombre, unidad: t.producto.unidad, cantidad: t.receta.cantidad })
      .from(t.receta)
      .innerJoin(t.producto, eq(t.producto.id, t.receta.productoId))
      .where(eq(t.receta.insumoId, id))
      .orderBy(asc(t.producto.nombre)),
  ]);
  const existenciaEn = (s: string) => existencias.find((e) => e.sucursalId === s)?.cantidad ?? 0;
  const puedeAjustar = sesion.puede("almacen.ajustar") || sesion.puede("insumos.editar");

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/insumos" />}>
        <ArrowLeft /> Insumos
      </Button>
      <Encabezado titulo={insumo.nombre} descripcion={`${formatoCostoUnitario(insumo.costo)} por ${insumo.unidad}${insumo.activo ? "" : " · inactivo"}`}>
        {sesion.puede("insumos.editar") && (
          <DialogoInsumo
            sucursal={null}
            insumo={{
              id: insumo.id,
              nombre: insumo.nombre,
              codigo: insumo.codigo ?? "",
              unidad: insumo.unidad,
              costo: costoUnitarioATexto(insumo.costo),
              existenciaMinima: String(insumo.existenciaMinima),
              activo: insumo.activo,
            }}
          />
        )}
      </Encabezado>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Existencias</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1">
              {sucursales.map((s) => {
                const cantidad = existenciaEn(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-2 py-1">
                    <span className="flex-1 text-sm">{s.nombre}</span>
                    <span className={`tabular-nums ${cantidad <= insumo.existenciaMinima ? "text-destructive font-semibold" : "font-medium"}`}>
                      {formatoCantidad(cantidad)} <span className="text-muted-foreground text-xs font-normal">{insumo.unidad}</span>
                    </span>
                    {puedeAjustar && <DialogoAjusteInsumo insumoId={insumo.id} sucursal={s} actual={cantidad} unidad={insumo.unidad} />}
                  </div>
                );
              })}
              <p className="text-muted-foreground mt-2 text-xs">Aviso cuando quedan {formatoCantidad(insumo.existenciaMinima)} o menos.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Se usa en</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1.5 text-sm">
              {usos.length === 0 && <p className="text-muted-foreground">Ningún producto lo tiene en su receta.</p>}
              {usos.map((u) => (
                <Link key={u.id} href={`/productos/${u.id}`} className="flex justify-between gap-2 hover:underline">
                  <span className="truncate">{u.nombre}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {formatoCantidad(u.cantidad)} por {u.unidad}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="min-w-0 py-0">
          <CardHeader className="pt-4">
            <CardTitle>Movimientos</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Movimiento</TableHead>
                <TableHead className="hidden sm:table-cell">Sucursal</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    Sin movimientos todavía.
                  </TableCell>
                </TableRow>
              )}
              {movimientos.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatoFechaHora(m.creadoEn)}</TableCell>
                  <TableCell className="whitespace-normal">
                    {ETIQUETA_MOTIVO[m.motivo]}
                    {m.folio && (
                      <Link href={`/ventas/${m.ventaId}`} className="text-primary ml-1 font-mono hover:underline">
                        {m.folio}
                      </Link>
                    )}
                    {m.compraId && (
                      <Link href={`/cuentas-por-pagar/compras/${m.compraId}`} className="text-primary ml-1 hover:underline">
                        ver compra
                      </Link>
                    )}
                    <span className="text-muted-foreground block text-xs">
                      {m.usuario}
                      {m.nota ? ` · ${m.nota}` : ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">{m.sucursal}</TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${m.cantidad < 0 ? "text-destructive" : "text-emerald-700"}`}>
                    {m.cantidad > 0 ? "+" : ""}
                    {formatoCantidad(m.cantidad)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
