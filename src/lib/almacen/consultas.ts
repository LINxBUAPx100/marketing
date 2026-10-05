import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";

/** Insumos y productos con existencias (no servicios), con lo que hay en la sucursal indicada. */
export async function articulosConExistencia(negocioId: string, sucursalId: string | null) {
  const [insumos, productos] = await Promise.all([
    db
      .select({
        id: t.insumo.id,
        nombre: t.insumo.nombre,
        unidad: t.insumo.unidad,
        costo: t.insumo.costo,
        existencia: sql<number>`coalesce(${t.existenciaInsumo.cantidad}, 0)::float`,
      })
      .from(t.insumo)
      .leftJoin(t.existenciaInsumo, and(eq(t.existenciaInsumo.insumoId, t.insumo.id), sucursalId ? eq(t.existenciaInsumo.sucursalId, sucursalId) : sql`false`))
      .where(and(eq(t.insumo.negocioId, negocioId), eq(t.insumo.activo, true)))
      .orderBy(asc(t.insumo.nombre)),
    db
      .select({
        id: t.producto.id,
        nombre: t.producto.nombre,
        unidad: t.producto.unidad,
        costo: sql<number>`coalesce(${t.producto.costo}, 0)::float`,
        existencia: sql<number>`coalesce(${t.existencia.cantidad}, 0)::float`,
      })
      .from(t.producto)
      .leftJoin(t.existencia, and(eq(t.existencia.productoId, t.producto.id), sucursalId ? eq(t.existencia.sucursalId, sucursalId) : sql`false`))
      .where(and(eq(t.producto.negocioId, negocioId), eq(t.producto.activo, true), eq(t.producto.tipo, "producto")))
      .orderBy(asc(t.producto.nombre)),
  ]);
  return [...insumos.map((i) => ({ ...i, tipo: "insumo" as const })), ...productos.map((p) => ({ ...p, tipo: "producto" as const }))];
}

export async function proveedoresActivos(negocioId: string) {
  return db
    .select({ id: t.proveedor.id, nombre: t.proveedor.nombre, diasCredito: t.proveedor.diasCredito })
    .from(t.proveedor)
    .where(and(eq(t.proveedor.negocioId, negocioId), eq(t.proveedor.activo, true)))
    .orderBy(asc(t.proveedor.nombre));
}
