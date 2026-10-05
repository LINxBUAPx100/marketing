"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import { moverInsumo } from "@/lib/almacen/existencias";
import { redondear3 } from "@/lib/almacen/reglas";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { datosDe, erroresDe, vacioANull, type EstadoFormulario } from "@/lib/formulario";

const sinPermiso = { mensaje: "No tienes permiso para hacer este cambio." };
const numero = (mensaje: string) =>
  z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? 0 : v), z.coerce.number({ error: mensaje }));

/** Costo por unidad en pesos con hasta 4 decimales ("0.725") → centavos con decimales (72.5). */
const costoPesos = z.preprocess((v) => {
  if (typeof v !== "string" || !v.trim()) return 0;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 1_000_000) / 10_000 : NaN;
}, z.number({ error: "Escribe un costo válido." }).min(0, { error: "No puede ser negativo." }));

const InsumoSchema = z.object({
  id: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  nombre: z.string().trim().min(2, { error: "Escribe el nombre del insumo." }),
  codigo: z.preprocess(vacioANull, z.string().trim().nullable().optional()),
  unidad: z.string().trim().min(1, { error: "Escribe la unidad (hoja, ml, m²…)." }),
  costo: costoPesos,
  existenciaMinima: numero("Escribe un número.").pipe(z.number().min(0)),
  existenciaInicial: numero("Escribe un número.").optional(),
  activo: z.preprocess((v) => v === undefined || v === "on" || v === "true", z.boolean()),
});

export async function guardarInsumo(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  const datos = InsumoSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { id, existenciaInicial, ...valores } = datos.data;
  if (!sesion.puede(id ? "insumos.editar" : "insumos.crear")) return sinPermiso;

  if (id) {
    const [actual] = await db
      .update(t.insumo)
      .set(valores)
      .where(and(eq(t.insumo.id, id), eq(t.insumo.negocioId, sesion.negocio.id)))
      .returning({ id: t.insumo.id });
    if (!actual) return { mensaje: "El insumo ya no existe." };
  } else {
    await db.transaction(async (tx) => {
      const [nuevo] = await tx
        .insert(t.insumo)
        .values({ ...valores, negocioId: sesion.negocio.id })
        .returning({ id: t.insumo.id });
      if (existenciaInicial && sesion.sucursal) {
        await moverInsumo(tx, {
          negocioId: sesion.negocio.id,
          sucursalId: sesion.sucursal.id,
          insumoId: nuevo.id,
          cantidad: redondear3(existenciaInicial),
          motivo: "inicial",
          usuarioId: sesion.usuario.id,
        });
      }
    });
  }
  await registrar(sesion, id ? "editar" : "crear", "insumo", id ?? null, { nombre: valores.nombre, costo: valores.costo });
  revalidatePath("/insumos", "layout");
  return { ok: true, mensaje: id ? "Insumo guardado." : "Insumo creado." };
}

export async function ajustarInsumo(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("almacen.ajustar") && !sesion.puede("insumos.editar")) return sinPermiso;
  const datos = z
    .object({
      insumoId: z.uuid(),
      sucursalId: z.uuid(),
      cantidad: z.coerce.number({ error: "Escribe la cantidad contada." }),
      nota: z.preprocess(vacioANull, z.string().trim().nullable().optional()),
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { insumoId, sucursalId, cantidad, nota } = datos.data;

  const [insumo] = await db.select().from(t.insumo).where(and(eq(t.insumo.id, insumoId), eq(t.insumo.negocioId, sesion.negocio.id)));
  const [sucursal] = await db.select().from(t.sucursal).where(and(eq(t.sucursal.id, sucursalId), eq(t.sucursal.negocioId, sesion.negocio.id)));
  if (!insumo || !sucursal) return { mensaje: "El insumo o la sucursal ya no existen." };

  const [actual] = await db
    .select({ cantidad: t.existenciaInsumo.cantidad })
    .from(t.existenciaInsumo)
    .where(and(eq(t.existenciaInsumo.insumoId, insumoId), eq(t.existenciaInsumo.sucursalId, sucursalId)));
  const diferencia = redondear3(cantidad - (actual?.cantidad ?? 0));
  if (diferencia === 0) return { ok: true, mensaje: "La existencia ya coincide; no hubo cambios." };

  await db.transaction((tx) =>
    moverInsumo(tx, { negocioId: sesion.negocio.id, sucursalId, insumoId, cantidad: diferencia, motivo: "ajuste", usuarioId: sesion.usuario.id, nota: nota ?? undefined }),
  );
  await registrar(sesion, "ajustar", "insumo", insumoId, { nombre: insumo.nombre, sucursal: sucursal.nombre, diferencia });
  revalidatePath(`/insumos/${insumoId}`);
  revalidatePath("/almacen");
  return { ok: true, mensaje: `Existencia ajustada (${diferencia > 0 ? "+" : ""}${diferencia}).` };
}

// ─── Recetas ────────────────────────────────────────────────────────────────

const RecetaSchema = z.object({
  productoId: z.uuid(),
  renglones: z.array(z.object({ insumoId: z.uuid(), cantidad: z.number().positive().max(1_000_000) })).max(50),
});

/** Reemplaza la receta completa de un producto. */
export async function guardarReceta(entrada: z.input<typeof RecetaSchema>) {
  const sesion = await requerirSesion();
  if (!sesion.puede("productos.editar")) return { ok: false as const, mensaje: "No tienes permiso para editar productos." };
  const datos = RecetaSchema.safeParse(entrada);
  if (!datos.success) return { ok: false as const, mensaje: "Revisa las cantidades: deben ser mayores que cero." };
  const { productoId, renglones } = datos.data;
  if (new Set(renglones.map((r) => r.insumoId)).size !== renglones.length) {
    return { ok: false as const, mensaje: "Un insumo aparece dos veces; junta las cantidades en un solo renglón." };
  }

  const [producto] = await db.select().from(t.producto).where(and(eq(t.producto.id, productoId), eq(t.producto.negocioId, sesion.negocio.id)));
  if (!producto) return { ok: false as const, mensaje: "El producto ya no existe." };
  if (renglones.length) {
    const validos = await db
      .select({ id: t.insumo.id })
      .from(t.insumo)
      .where(and(inArray(t.insumo.id, renglones.map((r) => r.insumoId)), eq(t.insumo.negocioId, sesion.negocio.id)));
    if (validos.length !== renglones.length) return { ok: false as const, mensaje: "Algún insumo ya no existe." };
  }

  await db.transaction(async (tx) => {
    await tx.delete(t.receta).where(eq(t.receta.productoId, productoId));
    if (renglones.length) await tx.insert(t.receta).values(renglones.map((r) => ({ productoId, insumoId: r.insumoId, cantidad: redondear3(r.cantidad) })));
  });
  await registrar(sesion, "editar", "receta", productoId, { nombre: producto.nombre, insumos: renglones.length });
  revalidatePath(`/productos/${productoId}`);
  return { ok: true as const };
}

