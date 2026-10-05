import "server-only";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, t } from "@/db";
import type { Sesion } from "@/lib/auth";

const responsable = alias(t.usuario, "responsable");
const movidoPor = alias(t.usuario, "movido_por");

/** Órdenes del tablero: activas, más las entregadas desde `entregadasDesde`. */
export async function ordenesDelTablero(sesion: Sesion, filtros: { sucursalIds: string[]; soloMias: boolean; entregadasDesde: Date }) {
  if (!filtros.sucursalIds.length) return [];
  const ordenes = await db
    .select({
      id: t.ordenProduccion.id,
      etapaId: t.ordenProduccion.etapaId,
      estado: t.ordenProduccion.estado,
      fechaCompromiso: t.ordenProduccion.fechaCompromiso,
      actualizadoEn: t.ordenProduccion.actualizadoEn,
      entregadaEn: t.ordenProduccion.entregadaEn,
      responsableId: t.ordenProduccion.responsableId,
      responsable: responsable.nombre,
      movidoPor: movidoPor.nombre,
      ventaId: t.venta.id,
      folio: t.venta.folio,
      total: t.venta.total,
      pagado: t.venta.pagado,
      cliente: t.cliente.nombre,
      telefono: t.cliente.telefono,
      sucursal: t.sucursal.nombre,
    })
    .from(t.ordenProduccion)
    .innerJoin(t.venta, eq(t.venta.id, t.ordenProduccion.ventaId))
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.ordenProduccion.sucursalId))
    .leftJoin(t.cliente, eq(t.cliente.id, t.venta.clienteId))
    .leftJoin(responsable, eq(responsable.id, t.ordenProduccion.responsableId))
    .leftJoin(movidoPor, eq(movidoPor.id, t.ordenProduccion.actualizadoPor))
    .where(
      and(
        eq(t.ordenProduccion.negocioId, sesion.negocio.id),
        inArray(t.ordenProduccion.sucursalId, filtros.sucursalIds),
        filtros.soloMias ? eq(t.ordenProduccion.responsableId, sesion.usuario.id) : undefined,
        sql`(${t.ordenProduccion.estado} = 'activa' or (${t.ordenProduccion.estado} = 'entregada' and ${t.ordenProduccion.entregadaEn} >= ${filtros.entregadasDesde}))`,
      ),
    )
    .orderBy(sql`${t.ordenProduccion.fechaCompromiso} asc nulls last`, asc(t.ordenProduccion.creadoEn));

  // Resumen de lo que lleva cada orden ("1 millar Volantes…").
  const ventaIds = ordenes.map((o) => o.ventaId);
  const partidas = ventaIds.length
    ? await db
        .select({ ventaId: t.ventaPartida.ventaId, descripcion: t.ventaPartida.descripcion, cantidad: t.ventaPartida.cantidad, unidad: t.ventaPartida.unidad })
        .from(t.ventaPartida)
        .where(inArray(t.ventaPartida.ventaId, ventaIds))
        .orderBy(asc(t.ventaPartida.orden))
    : [];
  return ordenes.map((o) => ({ ...o, partidas: partidas.filter((p) => p.ventaId === o.ventaId) }));
}

export type OrdenTablero = Awaited<ReturnType<typeof ordenesDelTablero>>[number];

export async function usuariosActivos(negocioId: string) {
  return db
    .select({ id: t.usuario.id, nombre: t.usuario.nombre })
    .from(t.usuario)
    .where(and(eq(t.usuario.negocioId, negocioId), eq(t.usuario.activo, true)))
    .orderBy(asc(t.usuario.nombre));
}

/** Historial de etapas de los últimos días, para medir tiempos. */
export async function eventosDesde(negocioId: string, desde: Date) {
  return db
    .select({ ordenId: t.ordenEvento.ordenId, etapaId: t.ordenEvento.etapaId, creadoEn: t.ordenEvento.creadoEn })
    .from(t.ordenEvento)
    .innerJoin(t.ordenProduccion, eq(t.ordenProduccion.id, t.ordenEvento.ordenId))
    .where(and(eq(t.ordenProduccion.negocioId, negocioId), gte(t.ordenProduccion.creadoEn, desde), sql`${t.ordenProduccion.estado} <> 'cancelada'`));
}
