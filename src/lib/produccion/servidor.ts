import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { Db } from "@/db/conexion";
import type { Sesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { ETAPAS_INICIALES } from "./reglas";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conexion = Db | Tx;

/** Etapas activas del negocio en orden. Si no hay ninguna, crea las de omisión. */
export async function etapasDe(negocioId: string) {
  const existentes = await db.select().from(t.etapaProduccion).where(eq(t.etapaProduccion.negocioId, negocioId)).orderBy(asc(t.etapaProduccion.orden));
  if (existentes.length) return existentes.filter((e) => e.activa);
  return db
    .insert(t.etapaProduccion)
    .values(ETAPAS_INICIALES.map((e, i) => ({ ...e, negocioId, orden: i + 1 })))
    .returning();
}

export async function notificar(
  cx: Conexion,
  datos: { negocioId: string; usuarioId: string; titulo: string; mensaje?: string; enlace?: string },
) {
  await cx.insert(t.notificacion).values(datos);
}

/** Crea la orden de una venta en la primera etapa. Se llama dentro de la transacción de la venta. */
export async function crearOrden(
  tx: Tx,
  datos: { negocioId: string; sucursalId: string; ventaId: string; folio: string; fechaCompromiso: Date | null; usuarioId: string; etapaInicial: { id: string; responsableId: string | null } },
) {
  const [orden] = await tx
    .insert(t.ordenProduccion)
    .values({
      negocioId: datos.negocioId,
      sucursalId: datos.sucursalId,
      ventaId: datos.ventaId,
      etapaId: datos.etapaInicial.id,
      responsableId: datos.etapaInicial.responsableId,
      fechaCompromiso: datos.fechaCompromiso,
      actualizadoPor: datos.usuarioId,
    })
    .returning();
  await tx.insert(t.ordenEvento).values({
    ordenId: orden.id,
    etapaId: datos.etapaInicial.id,
    responsableId: datos.etapaInicial.responsableId,
    usuarioId: datos.usuarioId,
    nota: "Orden creada al vender",
  });
  if (datos.etapaInicial.responsableId && datos.etapaInicial.responsableId !== datos.usuarioId) {
    await notificar(tx, {
      negocioId: datos.negocioId,
      usuarioId: datos.etapaInicial.responsableId,
      titulo: `Nueva orden ${datos.folio}`,
      mensaje: "Te tocó la primera etapa.",
      enlace: `/produccion/${orden.id}`,
    });
  }
  return orden;
}

export async function cancelarOrdenDeVenta(tx: Tx, ventaId: string) {
  await tx.update(t.ordenProduccion).set({ estado: "cancelada", actualizadoEn: new Date() }).where(eq(t.ordenProduccion.ventaId, ventaId));
}

type Resultado = { ok: true; listaVentaId?: string } | { ok: false; mensaje: string };

/**
 * Mueve la orden a otra etapa y/o cambia el responsable. Deja evento en el historial,
 * avisa al nuevo responsable y, si la orden queda lista, a quien la vendió.
 */
export async function moverOrden(
  sesion: Sesion,
  datos: { ordenId: string; etapaId: string; responsableId?: string | null; nota: string | null },
): Promise<Resultado> {
  const negocioId = sesion.negocio.id;
  const [fila] = await db
    .select({ orden: t.ordenProduccion, folio: t.venta.folio, vendedorId: t.venta.usuarioId })
    .from(t.ordenProduccion)
    .innerJoin(t.venta, eq(t.venta.id, t.ordenProduccion.ventaId))
    .where(and(eq(t.ordenProduccion.id, datos.ordenId), eq(t.ordenProduccion.negocioId, negocioId)));
  if (!fila) return { ok: false, mensaje: "La orden ya no existe." };
  if (fila.orden.estado === "cancelada") return { ok: false, mensaje: "La orden está cancelada." };

  const [etapa] = await db
    .select()
    .from(t.etapaProduccion)
    .where(and(eq(t.etapaProduccion.id, datos.etapaId), eq(t.etapaProduccion.negocioId, negocioId)));
  if (!etapa) return { ok: false, mensaje: "La etapa ya no existe." };

  // Sin responsable indicado: si cambia de etapa toma el de omisión de la etapa; si no, se queda el actual.
  const cambiaEtapa = etapa.id !== fila.orden.etapaId;
  const responsableId = datos.responsableId !== undefined ? datos.responsableId : cambiaEtapa ? etapa.responsableId : fila.orden.responsableId;
  if (responsableId) {
    const [r] = await db
      .select({ id: t.usuario.id })
      .from(t.usuario)
      .where(and(eq(t.usuario.id, responsableId), eq(t.usuario.negocioId, negocioId), eq(t.usuario.activo, true)));
    if (!r) return { ok: false, mensaje: "El responsable elegido no está activo." };
  }
  if (!cambiaEtapa && responsableId === fila.orden.responsableId && !datos.nota) return { ok: true };

  const ahora = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(t.ordenProduccion)
      .set({
        etapaId: etapa.id,
        responsableId,
        actualizadoEn: ahora,
        actualizadoPor: sesion.usuario.id,
        estado: etapa.tipo === "entregado" ? "entregada" : "activa",
        entregadaEn: etapa.tipo === "entregado" ? ahora : null,
      })
      .where(eq(t.ordenProduccion.id, fila.orden.id));
    await tx.insert(t.ordenEvento).values({ ordenId: fila.orden.id, etapaId: etapa.id, responsableId, usuarioId: sesion.usuario.id, nota: datos.nota });

    const enlace = `/produccion/${fila.orden.id}`;
    if (responsableId && responsableId !== sesion.usuario.id && responsableId !== fila.orden.responsableId) {
      await notificar(tx, { negocioId, usuarioId: responsableId, titulo: `Te asignaron ${fila.folio}`, mensaje: `Etapa: ${etapa.nombre}`, enlace });
    }
    if (cambiaEtapa && etapa.tipo === "listo" && fila.vendedorId !== sesion.usuario.id) {
      await notificar(tx, { negocioId, usuarioId: fila.vendedorId, titulo: `${fila.folio} está listo`, mensaje: "Avísale al cliente que puede pasar.", enlace });
    }
  });

  await registrar(sesion, cambiaEtapa ? "mover" : "asignar", "orden", fila.orden.id, { nombre: fila.folio, etapa: etapa.nombre });
  // Para el aviso de WhatsApp "pedido listo".
  return cambiaEtapa && etapa.tipo === "listo" ? { ok: true, listaVentaId: fila.orden.ventaId } : { ok: true };
}
