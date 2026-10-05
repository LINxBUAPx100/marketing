import { desc, eq, inArray, or, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoCantidad, formatoFechaHora } from "@/lib/numeros";

export const metadata: Metadata = { title: "Traspasos" };

export default async function PaginaTraspasos() {
  const sesion = await requerirPermiso("almacen.ver");
  const misSucursales = sesion.sucursales.map((s) => s.id);
  const origen = alias(t.sucursal, "origen");
  const destino = alias(t.sucursal, "destino");

  const traspasos = misSucursales.length
    ? await db
        .select({ traspaso: t.traspaso, origen: origen.nombre, destino: destino.nombre, usuario: t.usuario.nombre })
        .from(t.traspaso)
        .innerJoin(origen, eq(origen.id, t.traspaso.origenId))
        .innerJoin(destino, eq(destino.id, t.traspaso.destinoId))
        .innerJoin(t.usuario, eq(t.usuario.id, t.traspaso.usuarioId))
        .where(and(eq(t.traspaso.negocioId, sesion.negocio.id), or(inArray(t.traspaso.origenId, misSucursales), inArray(t.traspaso.destinoId, misSucursales))))
        .orderBy(desc(t.traspaso.creadoEn))
        .limit(100)
    : [];

  const partidas = traspasos.length
    ? await db
        .select({ traspasoId: t.traspasoPartida.traspasoId, cantidad: t.traspasoPartida.cantidad, insumo: t.insumo.nombre, producto: t.producto.nombre })
        .from(t.traspasoPartida)
        .leftJoin(t.insumo, eq(t.insumo.id, t.traspasoPartida.insumoId))
        .leftJoin(t.producto, eq(t.producto.id, t.traspasoPartida.productoId))
        .where(inArray(t.traspasoPartida.traspasoId, traspasos.map((x) => x.traspaso.id)))
    : [];

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/almacen" />}>
        <ArrowLeft /> Almacén
      </Button>
      <Encabezado titulo="Traspasos" descripcion="Mercancía que se movió de una sucursal a otra.">
        {sesion.puede("almacen.traspasar") && (
          <Button nativeButton={false} render={<Link href="/almacen/traspasos/nuevo" />}>
            <ArrowLeftRight /> Nuevo traspaso
          </Button>
        )}
      </Encabezado>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>De → a</TableHead>
              <TableHead>Qué se movió</TableHead>
              <TableHead className="hidden md:table-cell">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traspasos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-12 text-center">
                  Aún no hay traspasos.
                </TableCell>
              </TableRow>
            )}
            {traspasos.map(({ traspaso: tr, origen, destino, usuario }) => (
              <TableRow key={tr.id}>
                <TableCell className="font-mono text-sm font-medium">{tr.folio}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {origen} → {destino}
                </TableCell>
                <TableCell className="text-sm whitespace-normal">
                  {partidas
                    .filter((p) => p.traspasoId === tr.id)
                    .map((p) => `${formatoCantidad(p.cantidad)} ${p.insumo ?? p.producto}`)
                    .join(", ")}
                  {tr.notas && <span className="text-muted-foreground block text-xs">{tr.notas}</span>}
                </TableCell>
                <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                  {formatoFechaHora(tr.creadoEn)}
                  <span className="block text-xs">{usuario}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
