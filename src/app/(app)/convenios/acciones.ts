"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";

const ConvenioSchema = z.object({
  clienteId: z.uuid(),
  descuentoBp: z.number().int().min(0).max(9000, { error: "El descuento no puede pasar de 90 %." }),
  diasCredito: z.number().int().min(0).max(365),
  limiteCredito: z.number().int().min(0).nullable(),
  vigenteHasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .transform((v) => (v ? new Date(`${v}T23:59:59-06:00`) : null)),
  notas: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((v) => v || null),
  activo: z.boolean(),
  precios: z.array(z.object({ productoId: z.uuid(), precio: z.number().int().min(0) })).max(200),
});

export async function guardarConvenio(entrada: z.input<typeof ConvenioSchema>) {
  const sesion = await requerirSesion();
  if (!sesion.puede("convenios.editar")) return { ok: false as const, mensaje: "No tienes permiso para editar convenios." };
  const datos = ConvenioSchema.safeParse(entrada);
  if (!datos.success) return { ok: false as const, mensaje: datos.error.issues[0]?.message ?? "Revisa los datos del convenio." };
  const { precios, clienteId, ...valores } = datos.data;
  const negocioId = sesion.negocio.id;

  const [cliente] = await db.select().from(t.cliente).where(and(eq(t.cliente.id, clienteId), eq(t.cliente.negocioId, negocioId)));
  if (!cliente) return { ok: false as const, mensaje: "El cliente ya no existe." };
  if (new Set(precios.map((p) => p.productoId)).size !== precios.length) return { ok: false as const, mensaje: "Un producto aparece dos veces." };
  if (precios.length) {
    const validos = await db
      .select({ id: t.producto.id })
      .from(t.producto)
      .where(and(inArray(t.producto.id, precios.map((p) => p.productoId)), eq(t.producto.negocioId, negocioId)));
    if (validos.length !== precios.length) return { ok: false as const, mensaje: "Algún producto ya no existe." };
  }

  await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(t.convenio)
      .values({ ...valores, clienteId, negocioId })
      .onConflictDoUpdate({ target: t.convenio.clienteId, set: valores })
      .returning({ id: t.convenio.id });
    await tx.delete(t.convenioPrecio).where(eq(t.convenioPrecio.convenioId, c.id));
    if (precios.length) await tx.insert(t.convenioPrecio).values(precios.map((p) => ({ ...p, convenioId: c.id })));
  });
  await registrar(sesion, "editar", "convenio", clienteId, {
    nombre: cliente.nombre,
    descuento: valores.descuentoBp / 100,
    limite: valores.limiteCredito,
    precios: precios.length,
  });
  revalidatePath("/convenios", "layout");
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true as const };
}
