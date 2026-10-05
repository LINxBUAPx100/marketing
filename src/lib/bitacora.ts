import "server-only";
import { db, t } from "@/db";
import type { Sesion } from "./auth";

/** Deja constancia de quién hizo qué, en qué sucursal y cuándo. */
export async function registrar(
  sesion: Sesion,
  accion: string,
  entidad: string,
  entidadId?: string | null,
  detalle?: Record<string, unknown>,
) {
  await db.insert(t.bitacora).values({
    negocioId: sesion.negocio.id,
    usuarioId: sesion.usuario.id,
    sucursalId: sesion.sucursal?.id ?? null,
    accion,
    entidad,
    entidadId: entidadId ?? null,
    detalle: detalle ?? null,
  });
}
