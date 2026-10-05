"use server";

import { and, desc, eq, isNull, lte } from "drizzle-orm";
import { db, t } from "@/db";
import { obtenerSesion } from "@/lib/auth";

export type Aviso = { id: string; titulo: string; mensaje: string | null; enlace: string | null; fecha: Date; leida: boolean; tipo: "notificacion" | "seguimiento" };

/** Notificaciones recientes y seguimientos de cotización que ya tocan. */
export async function misAvisos(): Promise<{ avisos: Aviso[]; pendientes: number }> {
  const sesion = await obtenerSesion();
  if (!sesion) return { avisos: [], pendientes: 0 };

  const [notificaciones, seguimientos] = await Promise.all([
    db
      .select()
      .from(t.notificacion)
      .where(eq(t.notificacion.usuarioId, sesion.usuario.id))
      .orderBy(desc(t.notificacion.creadoEn))
      .limit(15),
    db
      .select({ id: t.seguimiento.id, nota: t.seguimiento.nota, fecha: t.seguimiento.fecha, cotizacionId: t.cotizacion.id, folio: t.cotizacion.folio, cliente: t.cliente.nombre })
      .from(t.seguimiento)
      .innerJoin(t.cotizacion, eq(t.cotizacion.id, t.seguimiento.cotizacionId))
      .innerJoin(t.cliente, eq(t.cliente.id, t.cotizacion.clienteId))
      .where(and(eq(t.seguimiento.usuarioId, sesion.usuario.id), isNull(t.seguimiento.hechoEn), lte(t.seguimiento.fecha, new Date()), eq(t.cotizacion.estado, "abierta")))
      .orderBy(desc(t.seguimiento.fecha))
      .limit(10),
  ]);

  const avisos: Aviso[] = [
    ...seguimientos.map((s) => ({
      id: `s-${s.id}`,
      titulo: `Seguimiento: ${s.folio} · ${s.cliente}`,
      mensaje: s.nota,
      enlace: `/cotizaciones/${s.cotizacionId}`,
      fecha: s.fecha,
      leida: false,
      tipo: "seguimiento" as const,
    })),
    ...notificaciones.map((n) => ({ id: n.id, titulo: n.titulo, mensaje: n.mensaje, enlace: n.enlace, fecha: n.creadoEn, leida: n.leida, tipo: "notificacion" as const })),
  ];
  return { avisos, pendientes: avisos.filter((a) => !a.leida).length };
}

export async function marcarLeidas() {
  const sesion = await obtenerSesion();
  if (!sesion) return;
  await db
    .update(t.notificacion)
    .set({ leida: true })
    .where(and(eq(t.notificacion.usuarioId, sesion.usuario.id), eq(t.notificacion.leida, false)));
}
