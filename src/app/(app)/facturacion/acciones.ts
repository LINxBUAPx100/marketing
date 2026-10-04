"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirSesion } from "@/lib/auth";
import { rangoDeDias } from "@/lib/fechas";
import { cancelarFactura, emitirComplemento, facturaGlobal, facturarVentas } from "@/lib/facturacion/servidor";
import { datosDe, erroresDe, vacioANull, type EstadoFormulario } from "@/lib/formulario";

const sinPermiso = { ok: false as const, mensaje: "No tienes permiso para timbrar facturas." };

export async function facturar(entrada: { ventaIds: string[]; usoCfdi: string | null; correo: string | null }) {
  const sesion = await requerirSesion();
  if (!sesion.puede("facturacion.timbrar")) return sinPermiso;
  const datos = z
    .object({
      ventaIds: z.array(z.uuid()).min(1).max(100),
      usoCfdi: z.string().regex(/^[A-Z]{1,2}\d{2}$/).nullable(),
      correo: z.email().nullable().or(z.literal("").transform(() => null)),
    })
    .safeParse(entrada);
  if (!datos.success) return { ok: false as const, mensaje: "Revisa los datos de la factura." };
  const r = await facturarVentas(sesion, datos.data);
  if (r.ok) {
    revalidatePath("/facturacion", "layout");
    for (const id of datos.data.ventaIds) revalidatePath(`/ventas/${id}`);
  }
  return r;
}

export async function global(entrada: { desde: string; hasta: string; periodicidad: "day" | "week" | "fortnight" | "month" | "two_months" }) {
  const sesion = await requerirSesion();
  if (!sesion.puede("facturacion.timbrar")) return sinPermiso;
  const datos = z
    .object({
      desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodicidad: z.enum(["day", "week", "fortnight", "month", "two_months"]),
    })
    .safeParse(entrada);
  if (!datos.success) return { ok: false as const, mensaje: "Revisa el periodo." };
  const { inicio, fin } = rangoDeDias(datos.data.desde, datos.data.hasta);
  const r = await facturaGlobal(sesion, { inicio, fin, periodicidad: datos.data.periodicidad, meses: datos.data.hasta.slice(5, 7), anio: Number(datos.data.hasta.slice(0, 4)) });
  if (r.ok) revalidatePath("/facturacion", "layout");
  return r;
}

export async function complemento(facturaId: string, pagoId: string) {
  const sesion = await requerirSesion();
  if (!sesion.puede("facturacion.timbrar")) return sinPermiso;
  if (!z.uuid().safeParse(facturaId).success || !z.uuid().safeParse(pagoId).success) return { ok: false as const, mensaje: "Datos inválidos." };
  const r = await emitirComplemento(sesion, facturaId, pagoId);
  if (r.ok) revalidatePath("/facturacion", "layout");
  return r;
}

export async function cancelar(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("facturacion.cancelar")) return { mensaje: "No tienes permiso para cancelar facturas." };
  const datos = z
    .object({
      id: z.uuid(),
      motivo: z.enum(["01", "02", "03", "04"], { error: "Elige el motivo." }),
      // Solo existe con el motivo 01; con los demás no se envía.
      sustitucion: z.preprocess(vacioANull, z.uuid({ error: "Escribe el UUID completo de la factura que la sustituye." }).nullable().optional()),
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const r = await cancelarFactura(sesion, datos.data.id, datos.data.motivo, datos.data.sustitucion ?? null);
  if (!r.ok) return { mensaje: r.mensaje };
  revalidatePath("/facturacion", "layout");
  return { ok: true, mensaje: "Factura cancelada." };
}
