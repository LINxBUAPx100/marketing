"use server";

import { and, asc, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { datosDe, erroresDe, vacioANull, type EstadoFormulario } from "@/lib/formulario";
import { RFC_VALIDO } from "@/lib/sat";

const textoOpcional = z.preprocess(vacioANull, z.string().trim().nullable().optional());

const ClienteSchema = z.object({
  id: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  nombre: z.string().trim().min(2, { error: "Escribe el nombre del cliente." }),
  empresa: textoOpcional,
  telefono: z.preprocess(
    vacioANull,
    z
      .string()
      .trim()
      .refine((v) => v.replace(/\D/g, "").length >= 10, { error: "Escribe el teléfono a 10 dígitos." })
      .nullable()
      .optional(),
  ),
  correo: z.preprocess(vacioANull, z.email({ error: "Escribe un correo válido." }).nullable().optional()),
  tipoPrecio: z.enum(["publico", "revendedor"]),
  rfc: z.preprocess(
    vacioANull,
    z.string().trim().toUpperCase().regex(RFC_VALIDO, { error: "El RFC no tiene un formato válido." }).nullable().optional(),
  ),
  razonSocial: textoOpcional,
  regimenFiscal: textoOpcional,
  codigoPostal: z.preprocess(
    vacioANull,
    z.string().trim().regex(/^\d{5}$/, { error: "El código postal tiene 5 dígitos." }).nullable().optional(),
  ),
  usoCfdi: textoOpcional,
  notas: textoOpcional,
  activo: z.preprocess((v) => v === undefined || v === "on" || v === "true", z.boolean()),
});

export async function guardarCliente(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  const datos = ClienteSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { id, ...valores } = datos.data;
  if (!sesion.puede(id ? "clientes.editar" : "clientes.crear")) return { mensaje: "No tienes permiso para hacer este cambio." };

  let cliente;
  if (id) {
    [cliente] = await db
      .update(t.cliente)
      .set(valores)
      .where(and(eq(t.cliente.id, id), eq(t.cliente.negocioId, sesion.negocio.id)))
      .returning();
    if (!cliente) return { mensaje: "El cliente ya no existe." };
  } else {
    [cliente] = await db
      .insert(t.cliente)
      .values({ ...valores, negocioId: sesion.negocio.id })
      .returning();
  }
  await registrar(sesion, id ? "editar" : "crear", "cliente", cliente.id, { nombre: cliente.nombre });
  revalidatePath("/clientes");
  return {
    ok: true,
    mensaje: id ? "Cliente actualizado." : "Cliente registrado.",
    datos: { id: cliente.id, nombre: cliente.nombre, empresa: cliente.empresa, telefono: cliente.telefono, tipoPrecio: cliente.tipoPrecio },
  };
}

/** Búsqueda rápida para el punto de venta. */
export async function buscarClientes(texto: string) {
  const sesion = await requerirSesion();
  if (!sesion.puede("ventas.crear") && !sesion.puede("clientes.ver")) return [];
  const patron = `%${texto.trim()}%`;
  return db
    .select({ id: t.cliente.id, nombre: t.cliente.nombre, empresa: t.cliente.empresa, telefono: t.cliente.telefono, tipoPrecio: t.cliente.tipoPrecio })
    .from(t.cliente)
    .where(
      and(
        eq(t.cliente.negocioId, sesion.negocio.id),
        eq(t.cliente.activo, true),
        texto.trim() ? or(ilike(t.cliente.nombre, patron), ilike(t.cliente.empresa, patron), ilike(t.cliente.telefono, patron)) : undefined,
      ),
    )
    .orderBy(asc(t.cliente.nombre))
    .limit(12);
}
