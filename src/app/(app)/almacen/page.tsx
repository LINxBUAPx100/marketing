import { and, asc, eq, inArray } from "drizzle-orm";
import { ArrowLeftRight, History, PackagePlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Buscador } from "@/components/buscador";
import { Encabezado } from "@/components/encabezado";
import { FiltroSelect } from "@/components/filtro-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoCantidad } from "@/lib/numeros";

export const metadata: Metadata = { title: "Almacén" };

export default async function PaginaAlmacen({ searchParams }: PageProps<"/almacen">) {
  const sesion = await requerirPermiso("almacen.ver");
  const { q, tipo, ver } = (await searchParams) as Record<string, string | undefined>;
  const negocioId = sesion.negocio.id;

  const sucursales = await db
    .select({ id: t.sucursal.id, nombre: t.sucursal.nombre })
    .from(t.sucursal)
    .where(and(eq(t.sucursal.negocioId, negocioId), eq(t.sucursal.activa, true)))
    .orderBy(asc(t.sucursal.creadoEn));
  const idsSucursal = sucursales.length ? sucursales.map((s) => s.id) : ["00000000-0000-0000-0000-000000000000"];
  const [insumos, productos, exInsumos, exProductos] = await Promise.all([
    db.select({ id: t.insumo.id, nombre: t.insumo.nombre, unidad: t.insumo.unidad, minimo: t.insumo.existenciaMinima }).from(t.insumo).where(and(eq(t.insumo.negocioId, negocioId), eq(t.insumo.activo, true))),
    db
      .select({ id: t.producto.id, nombre: t.producto.nombre, unidad: t.producto.unidad, minimo: t.producto.existenciaMinima })
      .from(t.producto)
      .where(and(eq(t.producto.negocioId, negocioId), eq(t.producto.activo, true), eq(t.producto.tipo, "producto"))),
    db.select().from(t.existenciaInsumo).where(inArray(t.existenciaInsumo.sucursalId, idsSucursal)),
    db.select().from(t.existencia).where(inArray(t.existencia.sucursalId, idsSucursal)),
  ]);

  const cantidadDe = (lista: { sucursalId: string; cantidad: number }[], sucursalId: string) => lista.find((e) => e.sucursalId === sucursalId)?.cantidad ?? 0;
  let filas = [
    ...insumos.map((i) => ({ ...i, tipo: "insumo" as const, href: `/insumos/${i.id}`, existencias: exInsumos.filter((e) => e.insumoId === i.id) })),
    ...productos.map((p) => ({ ...p, tipo: "producto" as const, href: `/productos/${p.id}`, existencias: exProductos.filter((e) => e.productoId === p.id) })),
  ]
    .map((a) => ({ ...a, porSucursal: sucursales.map((s) => cantidadDe(a.existencias, s.id)) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (tipo === "insumo" || tipo === "producto") filas = filas.filter((f) => f.tipo === tipo);
  if (q?.trim()) filas = filas.filter((f) => f.nombre.toLowerCase().includes(q.trim().toLowerCase()));
  // "Bajos": en alguna sucursal hay el mínimo o menos.
  if (ver === "bajos") filas = filas.filter((f) => f.porSucursal.some((c) => c <= f.minimo));

  return (
    <>
      <Encabezado titulo="Almacén" descripcion="Existencias de insumos y productos en cada sucursal. En rojo, lo que está en el mínimo o abajo.">
        <Button variant="ghost" nativeButton={false} render={<Link href="/almacen/traspasos" />}>
          <History /> Traspasos
        </Button>
        {sesion.puede("almacen.traspasar") && sucursales.length > 1 && (
          <Button variant="outline" nativeButton={false} render={<Link href="/almacen/traspasos/nuevo" />}>
            <ArrowLeftRight /> Traspasar
          </Button>
        )}
        {sesion.puede("cxp.crear") && (
          <Button nativeButton={false} render={<Link href="/cuentas-por-pagar/compras/nueva" />}>
            <PackagePlus /> Registrar compra
          </Button>
        )}
      </Encabezado>

      <Buscador placeholder="Buscar artículo" valor={q}>
        <FiltroSelect nombre="tipo" valor={tipo} etiqueta="Tipo">
          <option value="">Insumos y productos</option>
          <option value="insumo">Solo insumos</option>
          <option value="producto">Solo productos</option>
        </FiltroSelect>
        <FiltroSelect nombre="ver" valor={ver} etiqueta="Mostrar">
          <option value="">Todo</option>
          <option value="bajos">Por agotarse</option>
        </FiltroSelect>
      </Buscador>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Artículo</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Mínimo</TableHead>
              {sucursales.map((s) => (
                <TableHead key={s.id} className="text-right">
                  {s.nombre}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={2 + sucursales.length} className="text-muted-foreground py-12 text-center">
                  {ver === "bajos" ? "Nada por agotarse." : "No hay artículos con existencias."}
                </TableCell>
              </TableRow>
            )}
            {filas.map((f) => (
              <TableRow key={`${f.tipo}:${f.id}`}>
                <TableCell>
                  <Link href={f.href} className="font-medium hover:underline">
                    {f.nombre}
                  </Link>
                  <span className="text-muted-foreground block text-xs">
                    {f.tipo === "insumo" ? "Insumo" : "Producto"} · {f.unidad}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">{formatoCantidad(f.minimo)}</TableCell>
                {f.porSucursal.map((c, i) => (
                  <TableCell key={sucursales[i].id} className="text-right tabular-nums">
                    {c <= f.minimo ? <Badge variant="destructive">{formatoCantidad(c)}</Badge> : formatoCantidad(c)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
