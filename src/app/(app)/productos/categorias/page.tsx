import { asc, count, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { DialogoCategoria } from "./dialogo";

export const metadata: Metadata = { title: "Categorías" };

export default async function PaginaCategorias() {
  const sesion = await requerirPermiso("productos.ver");
  const puedeEditar = sesion.puede("productos.editar");
  const categorias = await db
    .select({ id: t.categoria.id, nombre: t.categoria.nombre, activa: t.categoria.activa, productos: count(t.producto.id) })
    .from(t.categoria)
    .leftJoin(t.producto, eq(t.producto.categoriaId, t.categoria.id))
    .where(eq(t.categoria.negocioId, sesion.negocio.id))
    .groupBy(t.categoria.id)
    .orderBy(asc(t.categoria.nombre));

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/productos" />}>
        <ArrowLeft /> Productos
      </Button>
      <Encabezado titulo="Categorías" descripcion="Agrupan los productos para encontrarlos más rápido al vender.">
        {puedeEditar && <DialogoCategoria />}
      </Encabezado>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Productos</TableHead>
              <TableHead>Estado</TableHead>
              {puedeEditar && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categorias.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                  Aún no hay categorías. Ejemplos: Volantes, Tarjetas, Lonas, Papelería.
                </TableCell>
              </TableRow>
            )}
            {categorias.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link href={`/productos?categoria=${c.id}`} className="hover:underline">
                    {c.nombre}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.productos}</TableCell>
                <TableCell>
                  <Badge variant={c.activa ? "secondary" : "outline"}>{c.activa ? "Activa" : "Inactiva"}</Badge>
                </TableCell>
                {puedeEditar && (
                  <TableCell>
                    <DialogoCategoria categoria={{ id: c.id, nombre: c.nombre, activa: c.activa }} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
