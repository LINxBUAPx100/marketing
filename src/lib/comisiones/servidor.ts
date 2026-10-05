import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, t } from "@/db";
import type { Sesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";

/** Una comisión se puede pagar cuando la venta sigue vigente y ya se cobró completa. */
const ventaCobrada = sql`${t.venta.estado} = 'activa' and ${t.venta.pagado} >= ${t.venta.total}`;

/** Por vendedor: lo que ya se puede pagar, lo que espera cobro y lo pagado desde una fecha. */
export async function resumenComisiones(negocioId: string, pagadasDesde: Date) {
  const filas = await db
    .select({
      usuarioId: t.comision.usuarioId,
      pagable: sql<number>`coalesce(sum(${t.comision.monto}) filter (where ${t.comision.estado} = 'pendiente' and ${ventaCobrada}), 0)::int`,
      porCobrar: sql<number>`coalesce(sum(${t.comision.monto}) filter (where ${t.comision.estado} = 'pendiente' and not (${ventaCobrada})), 0)::int`,
      pagado: sql<number>`coalesce(sum(${t.comision.monto}) filter (where ${t.comision.estado} = 'pagada' and ${t.comision.pagoId} in (select ${t.pagoComision.id} from ${t.pagoComision} where ${t.pagoComision.creadoEn} >= ${pagadasDesde})), 0)::int`,
      vendido: sql<number>`coalesce(sum(${t.comision.base}) filter (where ${t.comision.estado} <> 'cancelada' and ${t.comision.creadoEn} >= ${pagadasDesde}), 0)::int`,
    })
    .from(t.comision)
    .innerJoin(t.venta, eq(t.venta.id, t.comision.ventaId))
    .where(eq(t.comision.negocioId, negocioId))
    .groupBy(t.comision.usuarioId);
  return new Map(filas.map((f) => [f.usuarioId, f]));
}

export async function pagarComisiones(sesion: Sesion, usuarioId: string, d: { desdeCaja: boolean; notas: string | null }) {
  const negocioId = sesion.negocio.id;
  const [vendedor] = await db.select().from(t.usuario).where(and(eq(t.usuario.id, usuarioId), eq(t.usuario.negocioId, negocioId)));
  if (!vendedor) return { ok: false as const, mensaje: "El usuario no existe." };
  if (d.desdeCaja && !sesion.sucursal) return { ok: false as const, mensaje: "No tienes una caja asignada." };

  const resultado = await db.transaction(async (tx) => {
    const pagables = await tx
      .select({ id: t.comision.id, monto: t.comision.monto })
      .from(t.comision)
      .innerJoin(t.venta, eq(t.venta.id, t.comision.ventaId))
      .where(and(eq(t.comision.usuarioId, usuarioId), eq(t.comision.negocioId, negocioId), eq(t.comision.estado, "pendiente"), ventaCobrada));
    const total = pagables.reduce((s, c) => s + c.monto, 0);
    if (!total) return null;

    let movimientoCajaId: string | null = null;
    if (d.desdeCaja) {
      const [m] = await tx
        .insert(t.movimientoCaja)
        .values({
          negocioId,
          sucursalId: sesion.sucursal!.id,
          tipo: "egreso",
          categoria: "Comisiones",
          concepto: `Comisiones de ${vendedor.nombre}`,
          metodo: "efectivo",
          monto: total,
          usuarioId: sesion.usuario.id,
        })
        .returning({ id: t.movimientoCaja.id });
      movimientoCajaId = m.id;
    }
    const [pago] = await tx
      .insert(t.pagoComision)
      .values({ negocioId, usuarioId, total, movimientoCajaId, notas: d.notas, registradoPor: sesion.usuario.id })
      .returning({ id: t.pagoComision.id });
    await tx
      .update(t.comision)
      .set({ estado: "pagada", pagoId: pago.id })
      .where(inArray(t.comision.id, pagables.map((c) => c.id)));
    return { total, comisiones: pagables.length };
  });

  if (!resultado) return { ok: false as const, mensaje: "No hay comisiones cobradas pendientes de pago." };
  await registrar(sesion, "pagar", "comisiones", usuarioId, { nombre: vendedor.nombre, monto: resultado.total });
  return { ok: true as const, ...resultado };
}

