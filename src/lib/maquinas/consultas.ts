import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import { desgasteConsumible } from "./reglas";
import { ultimasLecturas } from "./servidor";

/** Máquinas de las sucursales indicadas, con contadores, última lectura y consumibles instalados. */
export async function maquinasCompletas(negocioId: string, sucursalIds: string[], soloActivas = true) {
  if (!sucursalIds.length) return [];
  const maquinas = await db
    .select({ maquina: t.maquina, sucursal: t.sucursal.nombre })
    .from(t.maquina)
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.maquina.sucursalId))
    .where(and(eq(t.maquina.negocioId, negocioId), inArray(t.maquina.sucursalId, sucursalIds), soloActivas ? eq(t.maquina.activa, true) : undefined))
    .orderBy(asc(t.sucursal.nombre), asc(t.maquina.nombre));
  const ids = maquinas.map((m) => m.maquina.id);
  if (!ids.length) return [];

  const [contadores, consumibles] = await Promise.all([
    db.select().from(t.contador).where(and(inArray(t.contador.maquinaId, ids), eq(t.contador.activo, true))).orderBy(asc(t.contador.nombre)),
    db.select().from(t.consumible).where(and(inArray(t.consumible.maquinaId, ids), isNull(t.consumible.retiradoEn))).orderBy(asc(t.consumible.nombre)),
  ]);
  const ultimas = await ultimasLecturas(contadores.map((c) => c.id));

  return maquinas.map(({ maquina, sucursal }) => ({
    ...maquina,
    sucursal,
    contadores: contadores.filter((c) => c.maquinaId === maquina.id).map((c) => ({ ...c, ultima: ultimas.get(c.id) ?? null })),
    consumibles: consumibles
      .filter((c) => c.maquinaId === maquina.id)
      .map((c) => ({
        ...c,
        desgaste: desgasteConsumible({
          lecturaInstalacion: c.lecturaInstalacion,
          lecturaActual: ultimas.get(c.contadorId)?.valor ?? c.lecturaInstalacion,
          rendimiento: c.rendimiento,
          instaladoEn: c.instaladoEn,
        }),
      })),
  }));
}

export type MaquinaCompleta = Awaited<ReturnType<typeof maquinasCompletas>>[number];
