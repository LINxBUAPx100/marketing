"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { datosDe, erroresDe, vacioANull, type EstadoFormulario } from "@/lib/formulario";
import { moverOrden } from "@/lib/produccion/servidor";

const MoverSchema = z.object({
  ordenId: z.uuid(),
  etapaId: z.uuid(),
  // undefined = que decida la etapa; null = sin responsable.
  responsableId: z.uuid().nullable().optional(),
  nota: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((v) => v || null),
});

export async function mover(entrada: z.input<typeof MoverSchema>) {
  const sesion = await requerirSesion();
  if (!sesion.puede("produccion.editar")) return { ok: false as const, mensaje: "No tienes permiso para mover órdenes." };
  const datos = MoverSchema.safeParse(entrada);
  if (!datos.success) return { ok: false as const, mensaje: "Datos incompletos." };
  const resultado = await moverOrden(sesion, datos.data);
  if (resultado.ok) {
    revalidatePath("/produccion");
    revalidatePath(`/produccion/${datos.data.ordenId}`);
  }
  return resultado;
}

// ─── Etapas ─────────────────────────────────────────────────────────────────

const EtapaSchema = z.object({
  id: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  nombre: z.string().trim().min(2, { error: "Escribe el nombre de la etapa." }).max(40),
  tipo: z.enum(["proceso", "listo", "entregado"]),
  responsableId: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  activa: z.preprocess((v) => v === undefined || v === "on" || v === "true", z.boolean()),
});

export async function guardarEtapa(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("produccion.etapas")) return { mensaje: "No tienes permiso para configurar etapas." };
  const datos = EtapaSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { id, ...valores } = datos.data;
  const negocioId = sesion.negocio.id;

  const todas = await db.select().from(t.etapaProduccion).where(eq(t.etapaProduccion.negocioId, negocioId)).orderBy(asc(t.etapaProduccion.orden));
  // Debe existir exactamente una etapa activa de "entregado" para poder cerrar órdenes.
  const otrasEntregado = todas.filter((e) => e.tipo === "entregado" && e.activa && e.id !== id);
  if (valores.tipo === "entregado" && valores.activa && otrasEntregado.length) {
    return { errores: { tipo: [`Ya existe la etapa de entrega "${otrasEntregado[0].nombre}".`] } };
  }
  const actual = todas.find((e) => e.id === id);
  if (actual?.tipo === "entregado" && (valores.tipo !== "entregado" || !valores.activa) && !otrasEntregado.length) {
    return { mensaje: "Debe quedar una etapa activa de tipo «Entregado»." };
  }

  if (id) {
    if (!actual) return { mensaje: "La etapa ya no existe." };
    await db.update(t.etapaProduccion).set(valores).where(eq(t.etapaProduccion.id, id));
  } else {
    // Las nuevas van antes de "Listo" y "Entregado".
    const primeraFinal = todas.find((e) => e.tipo !== "proceso");
    const orden = primeraFinal ? primeraFinal.orden : (todas.at(-1)?.orden ?? 0) + 1;
    await db.transaction(async (tx) => {
      for (const e of todas.filter((e) => e.orden >= orden)) {
        await tx.update(t.etapaProduccion).set({ orden: e.orden + 1 }).where(eq(t.etapaProduccion.id, e.id));
      }
      await tx.insert(t.etapaProduccion).values({ ...valores, negocioId, orden });
    });
  }
  await registrar(sesion, id ? "editar" : "crear", "etapa", id ?? null, { nombre: valores.nombre });
  revalidatePath("/produccion", "layout");
  return { ok: true, mensaje: id ? "Etapa guardada." : "Etapa agregada." };
}

/** Sube o baja una etapa en el orden del tablero. */
export async function reordenarEtapa(id: string, direccion: "subir" | "bajar") {
  const sesion = await requerirSesion();
  if (!sesion.puede("produccion.etapas")) return;
  const todas = await db
    .select()
    .from(t.etapaProduccion)
    .where(and(eq(t.etapaProduccion.negocioId, sesion.negocio.id)))
    .orderBy(asc(t.etapaProduccion.orden));
  const i = todas.findIndex((e) => e.id === id);
  const j = direccion === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= todas.length) return;
  await db.transaction(async (tx) => {
    await tx.update(t.etapaProduccion).set({ orden: todas[j].orden }).where(eq(t.etapaProduccion.id, todas[i].id));
    await tx.update(t.etapaProduccion).set({ orden: todas[i].orden }).where(eq(t.etapaProduccion.id, todas[j].id));
  });
  revalidatePath("/produccion", "layout");
}
