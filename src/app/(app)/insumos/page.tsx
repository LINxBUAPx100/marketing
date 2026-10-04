import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Buscador } from "@/components/buscador";
import { Encabezado } from "@/components/encabezado";
import { FiltroSelect } from "@/components/filtro-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoCantidad, formatoCostoUnitario, formatoMoneda } from "@/lib/numeros";
import { DialogoInsumo } from "./dialogo";

export const metadata: Metadata = { title: "Insumos" };

export default async function PaginaInsumos({ searchParams }: PageProps<"/insumos">) {
  const sesion = await requerirPermiso("insumos.ver");
  const { q, estado } = (await searchParams) as Record<string, string | undefined>;
  const sucursalId = sesion.sucursal?.id ?? null;

  const filtros = [eq(t.insumo.negocioId, sesion.negocio.id)];
  if (q?.trim()) filtros.push(or(ilike(t.insumo.nombre, `%${q.trim()}%`), ilike(t.insumo.codigo, `%${q.trim()}%`))!);
  if (estado !== "inactivos") filtros.push(eq(t.insumo.activo, true));
  else filtros.push(eq(t.insumo.activo, false));

  const filas = await db
    .select({
      id: t.insumo.id,
      nombre: t.insumo.nombre,
      codigo: t.insumo.codigo,
      unidad: t.insumo.unidad,
      costo: t.insumo.costo,
      existenciaMinima: t.insumo.existenciaMinima,
      existencia: sql<number>`coalesce(${t.existenciaInsumo.cantidad}, 0)::float`,
      productos: sql<number>`(select count(*) from ${t.receta} where ${t.receta.insumoId} = ${t.insumo.id})::int`,
    })
    .from(t.insumo)
    .leftJoin(t.existenciaInsumo, and(eq(t.existenciaInsumo.insumoId, t.insumo.id), sucursalId ? eq(t.existenciaInsumo.sucursalId, sucursalId) : sql`false`))
    .where(and(...filtros))
    .orderBy(asc(t.insumo.nombre));

  const insumos = estado === "bajos" ? filas.filter((i) => i.existencia <= i.existenciaMinima) : filas;
  const valor = filas.reduce((s, i) => s + Math.max(0, i.existencia) * i.costo, 0);
  const bajos = filas.filter((i) => i.existencia <= i.existenciaMinima).length;

  return (
    <>
      <Encabezado titulo="Insumos" descripcion={`Papel, tinta y materiales${sesion.sucursal ? ` en ${sesion.sucursal.nombre}` : ""}. Se descuentan solos al vender productos con receta.`}>
        {sesion.puede("insumos.crear") && <DialogoInsumo sucursal={sesion.sucursal?.nombre ?? null} />}
      </Encabezado>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Valor del inventario de insumos</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoMoneda(Math.round(valor))}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Por agotarse</CardDescription>
            <CardTitle className={`text-2xl tabular-nums ${bajos ? "text-destructive" : ""}`}>{bajos}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Buscador placeholder="Buscar insumo por nombre o código" valor={q}>
        <FiltroSelect nombre="estado" valor={estado} etiqueta="Mostrar">
          <option value="">Activos</option>
          <option value="bajos">Por agotarse</option>
          <option value="inactivos">Inactivos</option>
        </FiltroSelect>
      </Buscador>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Costo</TableHead>
              <TableHead className="hidden text-right md:table-cell">Mínimo</TableHead>
              <TableHead className="text-right">Existencia</TableHead>
              <TableHead className="hidden text-right lg:table-cell">En recetas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {insumos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-12 text-center">
                  {q || estado ? "Ningún insumo coincide." : "Aún no hay insumos. Da de alta el papel, la tinta y los materiales que usas."}
                </TableCell>
              </TableRow>
            )}
            {insumos.map((i) => {
              const bajo = i.existencia <= i.existenciaMinima;
              return (
                <TableRow key={i.id}>
                  <TableCell>
                    <Link href={`/insumos/${i.id}`} className="font-medium hover:underline">
                      {i.nombre}
                    </Link>
                    <span className="text-muted-foreground block text-xs">
                      {i.codigo ? `${i.codigo} · ` : ""}
                      {i.unidad}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatoCostoUnitario(i.costo)}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-right tabular-nums md:table-cell">{formatoCantidad(i.existenciaMinima)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {bajo ? <Badge variant="destructive">{formatoCantidad(i.existencia)}</Badge> : formatoCantidad(i.existencia)}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-right tabular-nums lg:table-cell">{i.productos || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
