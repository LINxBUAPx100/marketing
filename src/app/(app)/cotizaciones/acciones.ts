"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { cerrarCotizacion, guardarCotizacion } from "@/lib/cotizaciones/servidor";
import { datosDe, erroresDe, vacioANull, type EstadoFormulario } from "@/lib/formulario";

const centavos = z.number().int().min(0).max(1_000_000_000);
const textoLargo = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);
/** "2026-10-20" en hora de México → fin de ese día. */
const finDelDia = (fecha: string) => new Date(`${fecha}T23:59:59-06:00`);

const CotizacionSchema = z.object({
  id: z.uuid().nullable(),
  clienteId: z.uuid({ error: "Elige a qué cliente va la cotización." }),
  vigenciaHasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform(finDelDia),
  notas: textoLargo(1000),
  condiciones: textoLargo(2000),
  partidas: z
    .array(
      z.object({
        productoId: z.uuid().nullable(),
        descripcion: z.string().trim().max(200),
        cantidad: z.number().positive().max(1_000_000),
        precioUnitario: centavos,
        descuento: centavos,
        notas: textoLargo(500),
      }),
    )
    .max(100),
});

export async function guardar(entrada: z.input<typeof CotizacionSchema>) {
  const sesion = await requerirSesion();
  if (!sesion.puede(entrada.id ? "cotizaciones.editar" : "cotizaciones.crear")) {
    return { ok: false as const, mensaje: "No tienes permiso para guardar cotizaciones." };
  }
  const datos = CotizacionSchema.safeParse(entrada);
  if (!datos.success) return { ok: false as const, mensaje: datos.error.issues[0]?.message ?? "Revisa los datos de la cotización." };
  const resultado = await guardarCotizacion(sesion, datos.data);
  if (resultado.ok) revalidatePath("/cotizaciones", "layout");
  return resultado;
}

export async function cerrar(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("cotizaciones.cancelar")) return { mensaje: "No tienes permiso para cerrar cotizaciones." };
  const datos = z
    .object({
      id: z.uuid(),
      estado: z.enum(["rechazada", "cancelada"]),
      motivo: z.string().trim().min(3, { error: "Escribe el motivo." }).max(500),
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const r = await cerrarCotizacion(sesion, datos.data.id, datos.data.estado, datos.data.motivo);
  if (!r.ok) return { mensaje: r.mensaje };
  revalidatePath("/cotizaciones", "layout");
  return { ok: true, mensaje: datos.data.estado === "rechazada" ? "Marcada como rechazada." : "Cotización cancelada." };
}

// ─── Seguimientos ───────────────────────────────────────────────────────────

export async function programarSeguimiento(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("cotizaciones.ver")) return { mensaje: "No tienes permiso." };
  const datos = z
    .object({
      cotizacionId: z.uuid(),
      fecha: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Elige fecha y hora." })
        .transform((v) => new Date(`${v}:00-06:00`)),
      nota: z.string().trim().min(3, { error: "Escribe qué hay que hacer." }).max(300),
      usuarioId: z.preprocess(vacioANull, z.uuid().nullable().optional()),
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);

  const [c] = await db
    .select({ id: t.cotizacion.id, folio: t.cotizacion.folio })
    .from(t.cotizacion)
    .where(and(eq(t.cotizacion.id, datos.data.cotizacionId), eq(t.cotizacion.negocioId, sesion.negocio.id)));
  if (!c) return { mensaje: "La cotización ya no existe." };

  await db.insert(t.seguimiento).values({
    cotizacionId: c.id,
    usuarioId: datos.data.usuarioId ?? sesion.usuario.id,
    fecha: datos.data.fecha,
    nota: datos.data.nota,
  });
  await registrar(sesion, "crear", "seguimiento", c.id, { nombre: c.folio });
  revalidatePath(`/cotizaciones/${c.id}`);
  return { ok: true, mensaje: "Seguimiento programado." };
}

export async function completarSeguimiento(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  const datos = z
    .object({ id: z.uuid(), resultado: z.string().trim().min(2, { error: "¿Qué pasó?" }).max(300) })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);

  const [s] = await db
    .select({ seguimiento: t.seguimiento, cotizacionId: t.cotizacion.id })
    .from(t.seguimiento)
    .innerJoin(t.cotizacion, eq(t.cotizacion.id, t.seguimiento.cotizacionId))
    .where(and(eq(t.seguimiento.id, datos.data.id), eq(t.cotizacion.negocioId, sesion.negocio.id)));
  if (!s) return { mensaje: "El seguimiento ya no existe." };

  await db.update(t.seguimiento).set({ hechoEn: new Date(), resultado: datos.data.resultado }).where(eq(t.seguimiento.id, s.seguimiento.id));
  revalidatePath(`/cotizaciones/${s.cotizacionId}`);
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Seguimiento hecho." };
}
