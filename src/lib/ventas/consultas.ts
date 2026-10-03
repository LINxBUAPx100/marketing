import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, t } from "@/db";
import type { Sesion } from "@/lib/auth";

/** Venta completa para mostrar o imprimir. Null si no existe o el usuario no tiene acceso a su sucursal. */
export async function obtenerVenta(sesion: Sesion, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const canceladaPor = alias(t.usuario, "cancelada_por");

  const [fila] = await db
    .select({
      venta: t.venta,
      cliente: t.cliente,
      sucursal: t.sucursal,
      vendedor: t.usuario.nombre,
      canceladaPor: canceladaPor.nombre,
    })
    .from(t.venta)
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.venta.sucursalId))
    .innerJoin(t.usuario, eq(t.usuario.id, t.venta.usuarioId))
    .leftJoin(t.cliente, eq(t.cliente.id, t.venta.clienteId))
    .leftJoin(canceladaPor, eq(canceladaPor.id, t.venta.canceladaPor))
    .where(and(eq(t.venta.id, id), eq(t.venta.negocioId, sesion.negocio.id)));
  if (!fila) return null;
  if (!sesion.rol.esAdmin && !sesion.sucursales.some((s) => s.id === fila.venta.sucursalId)) return null;

  const [partidas, pagos] = await Promise.all([
    db.select().from(t.ventaPartida).where(eq(t.ventaPartida.ventaId, id)).orderBy(asc(t.ventaPartida.orden)),
    db
      .select({
        id: t.pago.id,
        metodo: t.pago.metodo,
        monto: t.pago.monto,
        recibido: t.pago.recibido,
        referencia: t.pago.referencia,
        cancelado: t.pago.cancelado,
        creadoEn: t.pago.creadoEn,
        usuario: t.usuario.nombre,
        sucursal: t.sucursal.nombre,
      })
      .from(t.pago)
      .innerJoin(t.usuario, eq(t.usuario.id, t.pago.usuarioId))
      .innerJoin(t.sucursal, eq(t.sucursal.id, t.pago.sucursalId))
      .where(eq(t.pago.ventaId, id))
      .orderBy(asc(t.pago.creadoEn)),
  ]);

  return { ...fila, partidas, pagos, saldo: fila.venta.estado === "activa" ? fila.venta.total - fila.venta.pagado : 0 };
}

export type VentaCompleta = NonNullable<Awaited<ReturnType<typeof obtenerVenta>>>;
