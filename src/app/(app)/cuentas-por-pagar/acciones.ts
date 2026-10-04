"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import { cancelarCompra, pagarCompra, registrarCompra } from "@/lib/almacen/servidor";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { METODOS } from "@/lib/caja/resumen";
import { datosDe, dinero, erroresDe, vacioANull, type EstadoFormulario } from "@/lib/formulario";
import { RFC_VALIDO } from "@/lib/sat";

const textoOpcional = z.preprocess(vacioANull, z.string().trim().nullable().optional());
const sinPermiso = { mensaje: "No tienes permiso para hacer este cambio." };

// ─── Proveedores ────────────────────────────────────────────────────────────

const ProveedorSchema = z.object({
  id: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  nombre: z.string().trim().min(2, { error: "Escribe el nombre del proveedor." }),
  contacto: textoOpcional,
  telefono: textoOpcional,
  correo: z.preprocess(vacioANull, z.email({ error: "Escribe un correo válido." }).nullable().optional()),
  rfc: z.preprocess(vacioANull, z.string().trim().toUpperCase().regex(RFC_VALIDO, { error: "El RFC no tiene un formato válido." }).nullable().optional()),
  diasCredito: z.coerce.number({ error: "Escribe un número de días." }).int().min(0).max(365),
  notas: textoOpcional,
  activo: z.preprocess((v) => v === undefined || v === "on" || v === "true", z.boolean()),
});

export async function guardarProveedor(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("cxp.crear")) return sinPermiso;
  const datos = ProveedorSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { id, ...valores } = datos.data;

  let proveedor;
  if (id) {
    [proveedor] = await db
      .update(t.proveedor)
      .set(valores)
      .where(and(eq(t.proveedor.id, id), eq(t.proveedor.negocioId, sesion.negocio.id)))
      .returning();
    if (!proveedor) return { mensaje: "El proveedor ya no existe." };
  } else {
    [proveedor] = await db.insert(t.proveedor).values({ ...valores, negocioId: sesion.negocio.id }).returning();
  }
  await registrar(sesion, id ? "editar" : "crear", "proveedor", proveedor.id, { nombre: proveedor.nombre });
  revalidatePath("/cuentas-por-pagar", "layout");
  return { ok: true, mensaje: id ? "Proveedor actualizado." : "Proveedor registrado.", datos: { id: proveedor.id, nombre: proveedor.nombre, diasCredito: proveedor.diasCredito } };
}

// ─── Compras ────────────────────────────────────────────────────────────────

const CompraSchema = z.object({
  proveedorId: z.uuid({ error: "Elige el proveedor." }),
  referencia: z
    .string()
    .trim()
    .max(60)
    .nullable()
    .transform((v) => v || null),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((v) => new Date(`${v}T12:00:00-06:00`)),
  diasCredito: z.number().int().min(0).max(365),
  notas: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((v) => v || null),
  actualizarCostos: z.boolean(),
  partidas: z.array(
    z.object({
      tipo: z.enum(["insumo", "producto"]),
      id: z.uuid(),
      cantidad: z.number().positive({ error: "Cada cantidad debe ser mayor que cero." }).max(10_000_000),
      // Centavos con decimales: el costo de una hoja puede ser 72.5 centavos.
      costoUnitario: z.number().min(0).max(1_000_000_000),
    }),
  ),
  pago: z
    .object({
      metodo: z.enum(METODOS),
      monto: z.number().int().positive(),
      referencia: z
        .string()
        .trim()
        .max(60)
        .nullable()
        .transform((v) => v || null),
      desdeCaja: z.boolean(),
    })
    .nullable(),
});

export async function guardarCompra(entrada: z.input<typeof CompraSchema>) {
  const sesion = await requerirSesion();
  if (!sesion.puede("cxp.crear")) return { ok: false as const, mensaje: "No tienes permiso para registrar compras." };
  const datos = CompraSchema.safeParse(entrada);
  if (!datos.success) return { ok: false as const, mensaje: datos.error.issues[0]?.message ?? "Revisa los datos de la compra." };
  const r = await registrarCompra(sesion, datos.data);
  if (r.ok) {
    revalidatePath("/cuentas-por-pagar", "layout");
    revalidatePath("/almacen");
    revalidatePath("/insumos", "layout");
    revalidatePath("/caja");
  }
  return r;
}

export async function pagar(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("cxp.pagar")) return { mensaje: "No tienes permiso para registrar pagos a proveedores." };
  const datos = z
    .object({
      compraId: z.uuid(),
      metodo: z.enum(METODOS),
      monto: dinero().refine((v) => v > 0, { error: "El monto debe ser mayor que cero." }),
      referencia: textoOpcional,
      desdeCaja: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { compraId, ...pago } = datos.data;
  const r = await pagarCompra(sesion, compraId, { ...pago, referencia: pago.referencia ?? null });
  if (!r.ok) return { mensaje: r.mensaje };
  revalidatePath("/cuentas-por-pagar", "layout");
  revalidatePath("/caja");
  return { ok: true, mensaje: "Pago registrado." };
}

export async function cancelar(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("cxp.crear")) return sinPermiso;
  const datos = z.object({ compraId: z.uuid(), motivo: z.string().trim().min(3, { error: "Escribe el motivo." }).max(300) }).safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const r = await cancelarCompra(sesion, datos.data.compraId, datos.data.motivo);
  if (!r.ok) return { mensaje: r.mensaje };
  revalidatePath("/cuentas-por-pagar", "layout");
  revalidatePath("/almacen");
  return { ok: true, mensaje: "Compra cancelada; las existencias se regresaron." };
}
