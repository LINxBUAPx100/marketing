import "server-only";
import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { moverInsumo } from "@/lib/almacen/existencias";
import type { Sesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { impresionesEnPeriodo, validarLectura, type TipoImpresion } from "./reglas";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; mensaje: string };

/** Máquina del negocio en una sucursal a la que el usuario tiene acceso. */
async function maquinaAccesible(sesion: Sesion, maquinaId: string) {
  const [m] = await db
    .select()
    .from(t.maquina)
    .where(and(eq(t.maquina.id, maquinaId), eq(t.maquina.negocioId, sesion.negocio.id)));
  if (!m || !sesion.sucursales.some((s) => s.id === m.sucursalId)) return null;
  return m;
}

/** Última lectura de cada contador indicado. */
export async function ultimasLecturas(contadorIds: string[]) {
  if (!contadorIds.length) return new Map<string, { valor: number; creadoEn: Date; usuario: string }>();
  const filas = await db
    .selectDistinctOn([t.lecturaContador.contadorId], {
      contadorId: t.lecturaContador.contadorId,
      valor: t.lecturaContador.valor,
      creadoEn: t.lecturaContador.creadoEn,
      usuario: t.usuario.nombre,
    })
    .from(t.lecturaContador)
    .innerJoin(t.usuario, eq(t.usuario.id, t.lecturaContador.usuarioId))
    .where(inArray(t.lecturaContador.contadorId, contadorIds))
    .orderBy(t.lecturaContador.contadorId, desc(t.lecturaContador.creadoEn));
  return new Map(filas.map((f) => [f.contadorId, f]));
}

// ─── Máquinas ───────────────────────────────────────────────────────────────

export type MaquinaEntrada = {
  sucursalId: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  notas: string | null;
  contadores: { nombre: string; tipo: TipoImpresion; lecturaInicial: number }[];
};

export async function crearMaquina(sesion: Sesion, e: MaquinaEntrada): Promise<Resultado<{ id: string }>> {
  if (!sesion.sucursales.some((s) => s.id === e.sucursalId)) return { ok: false, mensaje: "Elige una de tus sucursales." };
  if (!e.contadores.length) return { ok: false, mensaje: "Agrega al menos un contador (por ejemplo «Negro»)." };

  const id = await db.transaction(async (tx) => {
    const { contadores, ...datos } = e;
    const [m] = await tx
      .insert(t.maquina)
      .values({ ...datos, negocioId: sesion.negocio.id })
      .returning({ id: t.maquina.id });
    for (const c of contadores) {
      const [nuevo] = await tx.insert(t.contador).values({ maquinaId: m.id, nombre: c.nombre, tipo: c.tipo }).returning({ id: t.contador.id });
      await tx.insert(t.lecturaContador).values({ contadorId: nuevo.id, valor: c.lecturaInicial, momento: "otra", nota: "Lectura inicial", usuarioId: sesion.usuario.id });
    }
    return m.id;
  });
  await registrar(sesion, "crear", "maquina", id, { nombre: e.nombre });
  return { ok: true, id };
}

export async function agregarContador(sesion: Sesion, maquinaId: string, c: { nombre: string; tipo: TipoImpresion; lecturaInicial: number }): Promise<Resultado> {
  const m = await maquinaAccesible(sesion, maquinaId);
  if (!m) return { ok: false, mensaje: "La máquina no existe." };
  await db.transaction(async (tx) => {
    const [nuevo] = await tx.insert(t.contador).values({ maquinaId, nombre: c.nombre, tipo: c.tipo }).returning({ id: t.contador.id });
    await tx.insert(t.lecturaContador).values({ contadorId: nuevo.id, valor: c.lecturaInicial, momento: "otra", nota: "Lectura inicial", usuarioId: sesion.usuario.id });
  });
  await registrar(sesion, "crear", "contador", maquinaId, { nombre: `${m.nombre} · ${c.nombre}` });
  return { ok: true };
}

// ─── Lecturas ───────────────────────────────────────────────────────────────

export async function capturarLecturas(
  sesion: Sesion,
  e: { momento: "apertura" | "cierre" | "otra"; nota: string | null; lecturas: { contadorId: string; valor: number }[] },
): Promise<Resultado<{ guardadas: number }>> {
  if (!e.lecturas.length) return { ok: false, mensaje: "Escribe al menos una lectura." };
  const ids = e.lecturas.map((l) => l.contadorId);
  const contadores = await db
    .select({ id: t.contador.id, nombre: t.contador.nombre, maquina: t.maquina.nombre, sucursalId: t.maquina.sucursalId })
    .from(t.contador)
    .innerJoin(t.maquina, eq(t.maquina.id, t.contador.maquinaId))
    .where(and(inArray(t.contador.id, ids), eq(t.maquina.negocioId, sesion.negocio.id)));
  if (contadores.length !== new Set(ids).size || contadores.some((c) => !sesion.sucursales.some((s) => s.id === c.sucursalId))) {
    return { ok: false, mensaje: "Algún contador no existe o es de otra sucursal." };
  }

  const ultimas = await ultimasLecturas(ids);
  for (const l of e.lecturas) {
    const error = validarLectura(l.valor, ultimas.get(l.contadorId)?.valor ?? null);
    if (error) {
      const c = contadores.find((x) => x.id === l.contadorId)!;
      return { ok: false, mensaje: `${c.maquina} · ${c.nombre}: ${error}` };
    }
  }

  await db.insert(t.lecturaContador).values(e.lecturas.map((l) => ({ ...l, momento: e.momento, nota: e.nota, usuarioId: sesion.usuario.id })));
  await registrar(sesion, "crear", "lecturas", null, { nombre: e.momento, contadores: e.lecturas.length });
  return { ok: true, guardadas: e.lecturas.length };
}

// ─── Mermas ─────────────────────────────────────────────────────────────────

export async function registrarMerma(
  sesion: Sesion,
  e: { maquinaId: string; tipo: TipoImpresion; cantidad: number; motivo: (typeof t.MOTIVOS_MERMA)[number]; responsableId: string | null; nota: string | null },
): Promise<Resultado> {
  const m = await maquinaAccesible(sesion, e.maquinaId);
  if (!m) return { ok: false, mensaje: "La máquina no existe." };
  if (e.responsableId) {
    const [u] = await db.select({ id: t.usuario.id }).from(t.usuario).where(and(eq(t.usuario.id, e.responsableId), eq(t.usuario.negocioId, sesion.negocio.id)));
    if (!u) return { ok: false, mensaje: "El responsable no existe." };
  }
  await db.insert(t.merma).values({ ...e, negocioId: sesion.negocio.id, usuarioId: sesion.usuario.id });
  await registrar(sesion, "crear", "merma", e.maquinaId, { nombre: m.nombre, cantidad: e.cantidad, motivo: e.motivo });
  return { ok: true };
}

// ─── Consumibles ────────────────────────────────────────────────────────────

/**
 * Instala un consumible tomando la lectura actual del contador. Si hay uno activo con el
 * mismo nombre en la máquina, se retira en ese momento (es un cambio de tóner, tambor…).
 */
export async function instalarConsumible(
  sesion: Sesion,
  e: { maquinaId: string; contadorId: string; nombre: string; rendimiento: number; costo: number | null; insumoId: string | null },
): Promise<Resultado> {
  const m = await maquinaAccesible(sesion, e.maquinaId);
  if (!m) return { ok: false, mensaje: "La máquina no existe." };
  const [c] = await db.select().from(t.contador).where(and(eq(t.contador.id, e.contadorId), eq(t.contador.maquinaId, m.id)));
  if (!c) return { ok: false, mensaje: "Elige un contador de esta máquina." };
  const lectura = (await ultimasLecturas([c.id])).get(c.id);
  if (!lectura) return { ok: false, mensaje: "Captura primero una lectura de ese contador." };

  let costo = e.costo;
  if (e.insumoId) {
    const [i] = await db.select().from(t.insumo).where(and(eq(t.insumo.id, e.insumoId), eq(t.insumo.negocioId, sesion.negocio.id)));
    if (!i) return { ok: false, mensaje: "El insumo ya no existe." };
    costo ??= Math.round(i.costo);
  }

  await db.transaction(async (tx) => {
    const ahora = new Date();
    await tx
      .update(t.consumible)
      .set({ retiradoEn: ahora, lecturaRetiro: lectura.valor })
      .where(and(eq(t.consumible.maquinaId, m.id), eq(t.consumible.nombre, e.nombre), isNull(t.consumible.retiradoEn)));
    await tx.insert(t.consumible).values({ ...e, costo, lecturaInstalacion: lectura.valor, instaladoEn: ahora, usuarioId: sesion.usuario.id });
    if (e.insumoId) {
      await moverInsumo(tx, { negocioId: sesion.negocio.id, sucursalId: m.sucursalId, insumoId: e.insumoId, cantidad: -1, motivo: "ajuste", usuarioId: sesion.usuario.id, nota: `Instalado en ${m.nombre}` });
    }
  });
  await registrar(sesion, "instalar", "consumible", m.id, { nombre: `${e.nombre} en ${m.nombre}`, lectura: lectura.valor });
  return { ok: true };
}

export async function retirarConsumible(sesion: Sesion, consumibleId: string): Promise<Resultado> {
  const [fila] = await db
    .select({ consumible: t.consumible, maquina: t.maquina })
    .from(t.consumible)
    .innerJoin(t.maquina, eq(t.maquina.id, t.consumible.maquinaId))
    .where(and(eq(t.consumible.id, consumibleId), eq(t.maquina.negocioId, sesion.negocio.id)));
  if (!fila || fila.consumible.retiradoEn) return { ok: false, mensaje: "El consumible no existe o ya se retiró." };
  const lectura = (await ultimasLecturas([fila.consumible.contadorId])).get(fila.consumible.contadorId);
  await db
    .update(t.consumible)
    .set({ retiradoEn: new Date(), lecturaRetiro: lectura?.valor ?? fila.consumible.lecturaInstalacion })
    .where(eq(t.consumible.id, consumibleId));
  await registrar(sesion, "retirar", "consumible", fila.maquina.id, { nombre: `${fila.consumible.nombre} de ${fila.maquina.nombre}` });
  return { ok: true };
}

// ─── Control de impresiones ─────────────────────────────────────────────────

/** Contadores, ventas y mermas de una sucursal en un periodo, agrupados por tipo de impresión. */
export async function controlDeImpresiones(negocioId: string, sucursalId: string, inicio: Date, fin: Date) {
  const contadores = await db
    .select({ id: t.contador.id, nombre: t.contador.nombre, tipo: t.contador.tipo, maquinaId: t.maquina.id, maquina: t.maquina.nombre })
    .from(t.contador)
    .innerJoin(t.maquina, eq(t.maquina.id, t.contador.maquinaId))
    .where(and(eq(t.maquina.negocioId, negocioId), eq(t.maquina.sucursalId, sucursalId), eq(t.contador.activo, true)));
  const ids = contadores.map((c) => c.id);

  const [lecturas, vendidas, mermas] = await Promise.all([
    ids.length
      ? db
          .select({ contadorId: t.lecturaContador.contadorId, valor: t.lecturaContador.valor, fecha: t.lecturaContador.creadoEn })
          .from(t.lecturaContador)
          .where(and(inArray(t.lecturaContador.contadorId, ids), lt(t.lecturaContador.creadoEn, fin)))
      : [],
    db
      .select({ tipo: t.producto.tipoImpresion, impresiones: sql<number>`sum(${t.ventaPartida.cantidad} * ${t.producto.impresionesPorUnidad})::float` })
      .from(t.ventaPartida)
      .innerJoin(t.venta, eq(t.venta.id, t.ventaPartida.ventaId))
      .innerJoin(t.producto, eq(t.producto.id, t.ventaPartida.productoId))
      .where(and(eq(t.venta.sucursalId, sucursalId), eq(t.venta.estado, "activa"), gte(t.venta.creadoEn, inicio), lt(t.venta.creadoEn, fin), sql`${t.producto.tipoImpresion} is not null`))
      .groupBy(t.producto.tipoImpresion),
    db
      .select({
        tipo: t.merma.tipo,
        maquinaId: t.merma.maquinaId,
        motivo: t.merma.motivo,
        responsableId: t.merma.responsableId,
        cantidad: t.merma.cantidad,
      })
      .from(t.merma)
      .innerJoin(t.maquina, eq(t.maquina.id, t.merma.maquinaId))
      .where(and(eq(t.maquina.sucursalId, sucursalId), gte(t.merma.creadoEn, inicio), lt(t.merma.creadoEn, fin))),
  ]);

  const porContador = contadores.map((c) => ({
    ...c,
    medicion: impresionesEnPeriodo(
      lecturas.filter((l) => l.contadorId === c.id),
      inicio,
      fin,
    ),
  }));
  return { porContador, vendidas, mermas };
}
