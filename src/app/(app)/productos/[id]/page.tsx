import { and, asc, desc, eq, or } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { urlArchivo } from "@/lib/archivos";
import { ETIQUETA_MOTIVO } from "@/lib/almacen/reglas";
import { requerirPermiso } from "@/lib/auth";
import { centavosATexto, formatoCantidad, formatoFechaHora } from "@/lib/numeros";
import { FormularioProducto } from "../formulario";
import { DialogoAjuste } from "./dialogo-ajuste";
import { EditorReceta } from "./receta";
import { EditorVolumen } from "./volumen";

export const metadata: Metadata = { title: "Producto" };

export default async function PaginaProducto({ params }: PageProps<"/productos/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("productos.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const negocioId = sesion.negocio.id;

  const [producto] = await db
    .select()
    .from(t.producto)
    .where(and(eq(t.producto.id, id), eq(t.producto.negocioId, negocioId)));
  if (!producto) notFound();

  const [categorias, sucursales, existencias, movimientos, insumos, receta, volumen] = await Promise.all([
    db
      .select({ id: t.categoria.id, nombre: t.categoria.nombre })
      .from(t.categoria)
      .where(and(eq(t.categoria.negocioId, negocioId), or(eq(t.categoria.activa, true), eq(t.categoria.id, producto.categoriaId ?? id))))
      .orderBy(asc(t.categoria.nombre)),
    db
      .select({ id: t.sucursal.id, nombre: t.sucursal.nombre })
      .from(t.sucursal)
      .where(and(eq(t.sucursal.negocioId, negocioId), eq(t.sucursal.activa, true)))
      .orderBy(asc(t.sucursal.creadoEn)),
    db.select().from(t.existencia).where(eq(t.existencia.productoId, id)),
    db
      .select({
        id: t.movimientoInventario.id,
        cantidad: t.movimientoInventario.cantidad,
        motivo: t.movimientoInventario.motivo,
        nota: t.movimientoInventario.nota,
        creadoEn: t.movimientoInventario.creadoEn,
        sucursal: t.sucursal.nombre,
        usuario: t.usuario.nombre,
        folio: t.venta.folio,
        ventaId: t.venta.id,
      })
      .from(t.movimientoInventario)
      .innerJoin(t.sucursal, eq(t.sucursal.id, t.movimientoInventario.sucursalId))
      .leftJoin(t.usuario, eq(t.usuario.id, t.movimientoInventario.usuarioId))
      .leftJoin(t.venta, eq(t.venta.id, t.movimientoInventario.ventaId))
      .where(eq(t.movimientoInventario.productoId, id))
      .orderBy(desc(t.movimientoInventario.creadoEn))
      .limit(30),
    db
      .select({ id: t.insumo.id, nombre: t.insumo.nombre, unidad: t.insumo.unidad, costo: t.insumo.costo })
      .from(t.insumo)
      .where(and(eq(t.insumo.negocioId, negocioId), eq(t.insumo.activo, true)))
      .orderBy(asc(t.insumo.nombre)),
    db.select({ insumoId: t.receta.insumoId, cantidad: t.receta.cantidad }).from(t.receta).where(eq(t.receta.productoId, id)),
    db
      .select({ desde: t.precioVolumen.desde, precio: t.precioVolumen.precio, precioRevendedor: t.precioVolumen.precioRevendedor })
      .from(t.precioVolumen)
      .where(eq(t.precioVolumen.productoId, id))
      .orderBy(asc(t.precioVolumen.desde)),
  ]);

  const existenciaEn = (sucursalId: string) => existencias.find((e) => e.sucursalId === sucursalId)?.cantidad ?? 0;
  const verCostos = sesion.puede("productos.costos");
  const puedeAjustar = sesion.puede("almacen.ajustar") || sesion.puede("productos.editar");

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/productos" />}>
        <ArrowLeft /> Productos
      </Button>
      <Encabezado titulo={producto.nombre} descripcion={producto.activo ? undefined : "Este producto está inactivo: no aparece al vender."} />

      <FormularioProducto
        categorias={categorias}
        verCostos={verCostos}
        puedeEditar={sesion.puede("productos.editar")}
        sucursal={sesion.sucursal?.nombre ?? null}
        valores={{
          id: producto.id,
          nombre: producto.nombre,
          codigo: producto.codigo ?? "",
          categoriaId: producto.categoriaId ?? "",
          descripcion: producto.descripcion ?? "",
          tipo: producto.tipo,
          unidad: producto.unidad,
          precio: centavosATexto(producto.precio),
          precioRevendedor: centavosATexto(producto.precioRevendedor),
          costo: verCostos ? centavosATexto(producto.costo) : "",
          existenciaMinima: String(producto.existenciaMinima),
          activo: producto.activo,
          requiereProduccion: producto.requiereProduccion,
          tipoImpresion: producto.tipoImpresion ?? "",
          impresionesPorUnidad: String(producto.impresionesPorUnidad),
          imagenUrl: urlArchivo(producto.imagen),
        }}
      />

      <div className="mt-6 grid max-w-5xl gap-6 lg:grid-cols-2">
        <EditorVolumen productoId={producto.id} unidad={producto.unidad} inicial={volumen} puedeEditar={sesion.puede("productos.editar")} />
        {verCostos && (
          <div>
            <EditorReceta
              productoId={producto.id}
              unidadProducto={producto.unidad}
              precio={producto.precio}
              iva={{ ivaBp: sesion.negocio.ivaBp, preciosIncluyenIva: sesion.negocio.preciosIncluyenIva }}
              insumos={insumos}
              inicial={receta}
              puedeEditar={sesion.puede("productos.editar")}
            />
          </div>
        )}
      </div>

      {producto.tipo === "producto" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
          <Card className="content-start">
            <CardHeader>
              <CardTitle>Existencias por sucursal</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1">
              {sucursales.map((s) => {
                const cantidad = existenciaEn(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-2 py-1">
                    <span className="flex-1 text-sm">{s.nombre}</span>
                    <span className={`tabular-nums ${cantidad <= producto.existenciaMinima ? "text-destructive font-semibold" : "font-medium"}`}>
                      {formatoCantidad(cantidad)}
                    </span>
                    {puedeAjustar && <DialogoAjuste productoId={producto.id} sucursal={s} actual={cantidad} unidad={producto.unidad} />}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="min-w-0 py-0">
            <CardHeader className="pt-4">
              <CardTitle>Movimientos recientes</CardTitle>
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
                    <TableCell>
                      {ETIQUETA_MOTIVO[m.motivo]}
                      {m.folio && (
                        <Link href={`/ventas/${m.ventaId}`} className="text-primary ml-1 hover:underline">
                          {m.folio}
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
      )}
    </>
  );
}
