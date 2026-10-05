import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import type { Sesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { resumirCaja } from "./resumen";

/** Todo lo que ha pasado en la caja de la sucursal desde su último corte. */
export async function periodoActual(sucursalId: string) {
  const [pagos, movimientos] = await Promise.all([
    db
      .select({
        id: t.pago.id,
        metodo: t.pago.metodo,
        monto: t.pago.monto,
        referencia: t.pago.referencia,
        creadoEn: t.pago.creadoEn,
        ventaId: t.venta.id,
        folio: t.venta.folio,
        usuario: t.usuario.nombre,
      })
      .from(t.pago)
      .innerJoin(t.venta, eq(t.venta.id, t.pago.ventaId))
      .innerJoin(t.usuario, eq(t.usuario.id, t.pago.usuarioId))
      .where(and(eq(t.pago.sucursalId, sucursalId), isNull(t.pago.corteId), eq(t.pago.cancelado, false)))
      .orderBy(asc(t.pago.creadoEn)),
    db
      .select({
        id: t.movimientoCaja.id,
        tipo: t.movimientoCaja.tipo,
        categoria: t.movimientoCaja.categoria,
        concepto: t.movimientoCaja.concepto,
        metodo: t.movimientoCaja.metodo,
        monto: t.movimientoCaja.monto,
        creadoEn: t.movimientoCaja.creadoEn,
        usuario: t.usuario.nombre,
      })
      .from(t.movimientoCaja)
      .innerJoin(t.usuario, eq(t.usuario.id, t.movimientoCaja.usuarioId))
      .where(and(eq(t.movimientoCaja.sucursalId, sucursalId), isNull(t.movimientoCaja.corteId)))
      .orderBy(asc(t.movimientoCaja.creadoEn)),
  ]);
  return { pagos, movimientos, resumen: resumirCaja(pagos, movimientos) };
}

export async function hacerCorte(
  sesion: Sesion,
  datos: { efectivoContado: number; fondoSiguiente: number; notas: string | null },
) {
  const sucursal = sesion.sucursal;
  if (!sucursal) return { ok: false as const, mensaje: "No tienes una sucursal asignada." };
  if (datos.fondoSiguiente > datos.efectivoContado) {
    return { ok: false as const, mensaje: "El fondo que se queda no puede ser mayor al efectivo contado." };
  }

  const corte = await db.transaction(async (tx) => {
    // Se recalcula dentro de la transacción para que no se cuele un cobro a la mitad.
    const pagos = await tx
      .select({ metodo: t.pago.metodo, monto: t.pago.monto })
      .from(t.pago)
      .where(and(eq(t.pago.sucursalId, sucursal.id), isNull(t.pago.corteId), eq(t.pago.cancelado, false)));
    const movimientos = await tx
      .select({ tipo: t.movimientoCaja.tipo, metodo: t.movimientoCaja.metodo, monto: t.movimientoCaja.monto, categoria: t.movimientoCaja.categoria })
      .from(t.movimientoCaja)
      .where(and(eq(t.movimientoCaja.sucursalId, sucursal.id), isNull(t.movimientoCaja.corteId)));
    const resumen = resumirCaja(pagos, movimientos);

    const [c] = await tx
      .insert(t.corteCaja)
      .values({
        negocioId: sesion.negocio.id,
        sucursalId: sucursal.id,
        usuarioId: sesion.usuario.id,
        resumen: { ...resumen, numeroCobros: pagos.length },
        efectivoEsperado: resumen.efectivoEsperado,
        efectivoContado: datos.efectivoContado,
        fondoSiguiente: datos.fondoSiguiente,
        notas: datos.notas,
      })
      .returning();

    await tx
      .update(t.pago)
      .set({ corteId: c.id })
      .where(and(eq(t.pago.sucursalId, sucursal.id), isNull(t.pago.corteId)));
    await tx
      .update(t.movimientoCaja)
      .set({ corteId: c.id })
      .where(and(eq(t.movimientoCaja.sucursalId, sucursal.id), isNull(t.movimientoCaja.corteId)));

    // El efectivo que se queda en la caja abre el siguiente periodo.
    if (datos.fondoSiguiente > 0) {
      await tx.insert(t.movimientoCaja).values({
        negocioId: sesion.negocio.id,
        sucursalId: sucursal.id,
        tipo: "fondo",
        categoria: "Fondo de caja",
        concepto: "Fondo que quedó del corte anterior",
        monto: datos.fondoSiguiente,
        usuarioId: sesion.usuario.id,
      });
    }
    return c;
  });

  await registrar(sesion, "corte", "caja", corte.id, {
    nombre: sucursal.nombre,
    esperado: corte.efectivoEsperado,
    contado: corte.efectivoContado,
  });
  return { ok: true as const, id: corte.id };
}
