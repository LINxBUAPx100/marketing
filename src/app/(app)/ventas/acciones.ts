"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirSesion } from "@/lib/auth";
import { METODOS } from "@/lib/caja/resumen";
import { datosDe, erroresDe, type EstadoFormulario } from "@/lib/formulario";
import { reglasDeCliente } from "@/lib/ventas/reglas-cliente";
import { cancelarVenta, crearVenta, registrarAbono } from "@/lib/ventas/servidor";

const centavos = z.number().int().min(0).max(1_000_000_000);
const textoCorto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);

const PagoSchema = z.object({
  metodo: z.enum(METODOS),
  monto: centavos.min(1, { error: "Cada pago debe ser mayor que cero." }),
  recibido: centavos.nullable(),
  referencia: textoCorto(120),
});

const VentaSchema = z.object({
  clienteId: z.uuid().nullable(),
  // "2026-10-05T17:00" escrito en hora del centro de México (UTC−6, sin horario de verano).
  fechaEntrega: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .nullable()
    .transform((v) => (v ? new Date(`${v}:00-06:00`) : null)),
  notas: textoCorto(1000),
  partidas: z
    .array(
      z.object({
        productoId: z.uuid().nullable(),
        descripcion: z.string().trim().max(200),
        cantidad: z.number().positive().max(1_000_000),
        precioUnitario: centavos,
        descuento: centavos,
        notas: textoCorto(500),
      }),
    )
    .max(100),
  pagos: z.array(PagoSchema).max(10),
  enviarProduccion: z.boolean(),
  cotizacionId: z.uuid().nullable(),
});

export type VentaNueva = z.input<typeof VentaSchema>;
export type PagoNuevo = z.input<typeof PagoSchema>;

export async function registrarVenta(entrada: VentaNueva) {
  const sesion = await requerirSesion();
  if (!sesion.puede("ventas.crear")) return { ok: false as const, mensaje: "No tienes permiso para vender." };
  const datos = VentaSchema.safeParse(entrada);
  if (!datos.success) return { ok: false as const, mensaje: "Revisa las cantidades y los importes de la venta." };

  const resultado = await crearVenta(sesion, datos.data);
  if (resultado.ok) {
    revalidatePath("/ventas");
    revalidatePath("/caja");
    revalidatePath("/produccion");
    revalidatePath("/cotizaciones");
  }
  return resultado;
}

export async function abonar(ventaId: string, pagos: PagoNuevo[]) {
  const sesion = await requerirSesion();
  if (!sesion.puede("cxc.abonar") && !sesion.puede("ventas.crear")) {
    return { ok: false as const, mensaje: "No tienes permiso para registrar pagos." };
  }
  const datos = z.object({ ventaId: z.uuid(), pagos: z.array(PagoSchema).min(1).max(10) }).safeParse({ ventaId, pagos });
  if (!datos.success) return { ok: false as const, mensaje: "Revisa el importe del pago." };

  const resultado = await registrarAbono(sesion, datos.data.ventaId, datos.data.pagos);
  if (resultado.ok) {
    revalidatePath(`/ventas/${ventaId}`);
    revalidatePath("/cuentas-por-cobrar");
    revalidatePath("/caja");
  }
  return resultado;
}

export async function cancelar(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("ventas.cancelar")) return { mensaje: "No tienes permiso para cancelar ventas." };
  const datos = z
    .object({
      ventaId: z.uuid(),
      motivo: z.string().trim().min(5, { error: "Explica brevemente por qué se cancela." }).max(500),
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);

  const resultado = await cancelarVenta(sesion, datos.data.ventaId, datos.data.motivo);
  if (!resultado.ok) return { mensaje: resultado.mensaje };
  revalidatePath(`/ventas/${datos.data.ventaId}`);
  revalidatePath("/ventas");
  revalidatePath("/caja");
  return { ok: true, mensaje: "Venta cancelada." };
}

/** Convenio, saldo y límite de crédito del cliente elegido en el punto de venta o en una cotización. */
export async function reglasCliente(clienteId: string | null) {
  const sesion = await requerirSesion();
  if (clienteId && !z.uuid().safeParse(clienteId).success) return null;
  return reglasDeCliente(sesion.negocio.id, clienteId);
}
