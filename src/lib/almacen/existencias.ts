import "server-only";
import { sql } from "drizzle-orm";
import { t } from "@/db";
import type { Db } from "@/db/conexion";

// Movimientos de existencias y folios. Siempre dentro de una transacción.

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Siguiente número consecutivo de la sucursal para un tipo de documento. Atómico. */
export async function siguienteNumero(tx: Tx, sucursalId: string, tipo: string) {
  const [f] = await tx
    .insert(t.folio)
    .values({ sucursalId, tipo, ultimo: 1 })
    .onConflictDoUpdate({ target: [t.folio.sucursalId, t.folio.tipo], set: { ultimo: sql`${t.folio.ultimo} + 1` } })
    .returning();
  return f.ultimo;
}

/** Siguiente folio de la sucursal, p. ej. "MAT-0042". Atómico dentro de la transacción. */
export async function siguienteFolio(tx: Tx, sucursalId: string, prefijo: string, tipo: string) {
  return `${prefijo}-${String(await siguienteNumero(tx, sucursalId, tipo)).padStart(4, "0")}`;
}

export async function moverExistencia(
  tx: Tx,
  datos: { negocioId: string; sucursalId: string; productoId: string; cantidad: number; motivo: (typeof t.movimientoInventario.$inferInsert)["motivo"]; ventaId?: string; compraId?: string; traspasoId?: string; usuarioId: string; nota?: string },
) {
  await tx
    .insert(t.existencia)
    .values({ productoId: datos.productoId, sucursalId: datos.sucursalId, cantidad: datos.cantidad })
    .onConflictDoUpdate({
      target: [t.existencia.productoId, t.existencia.sucursalId],
      set: { cantidad: sql`${t.existencia.cantidad} + ${datos.cantidad}` },
    });
  await tx.insert(t.movimientoInventario).values(datos);
}

export async function moverInsumo(
  tx: Tx,
  d: {
    negocioId: string;
    sucursalId: string;
    insumoId: string;
    cantidad: number;
    motivo: (typeof t.MOTIVOS_INSUMO)[number];
    usuarioId: string;
    ventaId?: string;
    compraId?: string;
    traspasoId?: string;
    nota?: string;
  },
) {
  await tx
    .insert(t.existenciaInsumo)
    .values({ insumoId: d.insumoId, sucursalId: d.sucursalId, cantidad: d.cantidad })
    .onConflictDoUpdate({
      target: [t.existenciaInsumo.insumoId, t.existenciaInsumo.sucursalId],
      set: { cantidad: sql`${t.existenciaInsumo.cantidad} + ${d.cantidad}` },
    });
  await tx.insert(t.movimientoInsumo).values(d);
}
