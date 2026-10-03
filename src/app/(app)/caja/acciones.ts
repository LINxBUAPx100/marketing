"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, t } from "@/db";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { METODOS } from "@/lib/caja/resumen";
import { hacerCorte } from "@/lib/caja/servidor";
import { datosDe, dinero, erroresDe, vacioANull, type EstadoFormulario } from "@/lib/formulario";

const MovimientoSchema = z.object({
  tipo: z.enum(["ingreso", "egreso", "fondo"]),
  categoria: z.string().trim().min(2, { error: "Elige o escribe una categoría." }).max(60),
  concepto: z.string().trim().min(3, { error: "Describe el movimiento." }).max(200),
  metodo: z.enum(METODOS),
  monto: dinero().refine((v) => v > 0, { error: "El monto debe ser mayor que cero." }),
});

export async function registrarMovimiento(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("caja.movimientos")) return { mensaje: "No tienes permiso para registrar movimientos de caja." };
  if (!sesion.sucursal) return { mensaje: "No tienes una sucursal asignada." };
  const datos = MovimientoSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  // El fondo siempre es efectivo físico en la caja.
  const valores = datos.data.tipo === "fondo" ? { ...datos.data, metodo: "efectivo" as const } : datos.data;

  const [m] = await db
    .insert(t.movimientoCaja)
    .values({ ...valores, negocioId: sesion.negocio.id, sucursalId: sesion.sucursal.id, usuarioId: sesion.usuario.id })
    .returning();
  await registrar(sesion, "crear", "movimiento_caja", m.id, { nombre: valores.concepto, tipo: valores.tipo, monto: valores.monto });
  revalidatePath("/caja");
  const textos = { ingreso: "Ingreso registrado.", egreso: "Gasto registrado.", fondo: "Fondo de caja registrado." };
  return { ok: true, mensaje: textos[valores.tipo] };
}

export async function corte(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("caja.corte")) return { mensaje: "No tienes permiso para hacer cortes de caja." };
  const datos = z
    .object({
      efectivoContado: dinero("Escribe el efectivo que contaste."),
      fondoSiguiente: z.preprocess((v) => (v === "" || v == null ? "0" : v), dinero("Escribe cuánto efectivo se queda.")),
      notas: z.preprocess(vacioANull, z.string().trim().max(500).nullable()),
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);

  const resultado = await hacerCorte(sesion, datos.data);
  if (!resultado.ok) return { mensaje: resultado.mensaje };
  revalidatePath("/caja");
  redirect(`/caja/cortes/${resultado.id}`);
}
