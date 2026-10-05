import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { ImageOff, Plus, Tags } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Buscador } from "@/components/buscador";
import { BotonExcel } from "@/components/boton-excel";
import { Encabezado } from "@/components/encabezado";
import { FiltroSelect } from "@/components/filtro-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { urlArchivo } from "@/lib/archivos";
import { requerirPermiso } from "@/lib/auth";
import { formatoCantidad, formatoMoneda } from "@/lib/numeros";

export const metadata: Metadata = { title: "Productos" };

export default async function PaginaProductos({ searchParams }: PageProps<"/productos">) {
  const sesion = await requerirPermiso("productos.ver");
  const { q, categoria, estado } = (await searchParams) as Record<string, string | undefined>;
  const negocioId = sesion.negocio.id;
  const sucursalId = sesion.sucursal?.id ?? null;
  const verCostos = sesion.puede("productos.costos");

  const filtros = [eq(t.producto.negocioId, negocioId)];
  if (q?.trim()) {
    const patron = `%${q.trim()}%`;
    filtros.push(or(ilike(t.producto.nombre, patron), ilike(t.producto.codigo, patron))!);
  }
  if (categoria) filtros.push(eq(t.producto.categoriaId, categoria));
  if (estado !== "todos") filtros.push(eq(t.producto.activo, estado !== "inactivos"));

  const [productos, categorias] = await Promise.all([
    db
      .select({
        id: t.producto.id,
        nombre: t.producto.nombre,
        codigo: t.producto.codigo,
        tipo: t.producto.tipo,
        unidad: t.producto.unidad,
        precio: t.producto.precio,
        precioRevendedor: t.producto.precioRevendedor,
        costo: t.producto.costo,
        imagen: t.producto.imagen,
        activo: t.producto.activo,
        existenciaMinima: t.producto.existenciaMinima,
        categoria: t.categoria.nombre,
        existencia: sql<number | null>`${t.existencia.cantidad}::float`,
      })
      .from(t.producto)
      .leftJoin(t.categoria, eq(t.categoria.id, t.producto.categoriaId))
      .leftJoin(t.existencia, and(eq(t.existencia.productoId, t.producto.id), sucursalId ? eq(t.existencia.sucursalId, sucursalId) : sql`false`))
      .where(and(...filtros))
      .orderBy(asc(t.producto.nombre))
      .limit(300),
    db.select().from(t.categoria).where(eq(t.categoria.negocioId, negocioId)).orderBy(asc(t.categoria.nombre)),
  ]);

  return (
    <>
      <Encabezado titulo="Productos" descripcion={`Precios y existencias${sesion.sucursal ? ` en ${sesion.sucursal.nombre}` : ""}.`}>
        <BotonExcel catalogo="productos" parametros={{ sucursal: sesion.sucursal?.id }} />
        <Button variant="outline" nativeButton={false} render={<Link href="/productos/categorias" />}>
          <Tags /> Categorías
        </Button>
        {sesion.puede("productos.crear") && (
          <Button nativeButton={false} render={<Link href="/productos/nuevo" />}>
            <Plus /> Nuevo producto
          </Button>
        )}
      </Encabezado>

      <Buscador placeholder="Buscar por nombre o código" valor={q}>
        <FiltroSelect nombre="categoria" valor={categoria} etiqueta="Categoría">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </FiltroSelect>
        <FiltroSelect nombre="estado" valor={estado} etiqueta="Estado">
          <option value="">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </FiltroSelect>
      </Buscador>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden md:table-cell">Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Revendedor</TableHead>
              {verCostos && <TableHead className="hidden text-right lg:table-cell">Costo</TableHead>}
              <TableHead className="text-right">Existencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-12 text-center">
                  {q || categoria ? "Ningún producto coincide con la búsqueda." : "Aún no hay productos. Da de alta el primero con «Nuevo producto»."}
                </TableCell>
              </TableRow>
            )}
            {productos.map((p) => {
              const bajo = p.tipo === "producto" && (p.existencia ?? 0) <= p.existenciaMinima;
              return (
                <TableRow key={p.id} className={p.activo ? undefined : "opacity-55"}>
                  <TableCell>
                    <Link href={`/productos/${p.id}`} className="group flex items-center gap-3 outline-none">
                      {p.imagen ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urlArchivo(p.imagen)!} alt="" className="size-10 shrink-0 rounded-md border object-cover" />
                      ) : (
                        <span className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-md">
                          <ImageOff className="size-4" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:underline group-focus-visible:underline">{p.nombre}</span>
                        <span className="text-muted-foreground block text-xs">
                          {p.codigo ? `${p.codigo} · ` : ""}
                          {p.unidad}
                          {!p.activo && " · inactivo"}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">{p.categoria ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(p.precio)}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">
                    {p.precioRevendedor != null ? formatoMoneda(p.precioRevendedor) : "—"}
                  </TableCell>
                  {verCostos && (
                    <TableCell className="text-muted-foreground hidden text-right tabular-nums lg:table-cell">
                      {p.costo != null ? formatoMoneda(p.costo) : "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">
                    {p.tipo === "servicio" ? (
                      <span className="text-muted-foreground text-xs">Servicio</span>
                    ) : bajo ? (
                      <Badge variant="destructive">{formatoCantidad(p.existencia ?? 0)}</Badge>
                    ) : (
                      formatoCantidad(p.existencia ?? 0)
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
