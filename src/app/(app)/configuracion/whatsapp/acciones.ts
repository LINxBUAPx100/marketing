"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { CLAVES_PLANTILLAS, type ClavePlantilla } from "@/lib/mensajes/plantillas";
import { enviarAviso, reintentarMensaje } from "@/lib/mensajes/servidor";

// Quién puede mandar cada aviso a mano: quien puede ver el registro del que sale.
const PERMISO: Record<ClavePlantilla, string> = {
  venta_registrada: "ventas.ver",
  pedido_listo: "produccion.ver",
  factura_emitida: "facturacion.ver",
  cotizacion_enviada: "cotizaciones.ver",
  recordatorio_saldo: "cxc.ver",
};

export async function mandarWhatsApp(clave: ClavePlantilla, entidadId: string) {
  const sesion = await requerirSesion();
  if (!z.enum(CLAVES_PLANTILLAS).safeParse(clave).success || !z.uuid().safeParse(entidadId).success) return { ok: false as const, mensaje: "Datos inválidos." };
  if (!sesion.puede(PERMISO[clave])) return { ok: false as const, mensaje: "No tienes permiso para mandar este mensaje." };
  const r = await enviarAviso({ negocioId: sesion.negocio.id, clave, entidadId, usuarioId: sesion.usuario.id, automatico: false });
  revalidatePath("/configuracion/whatsapp");
  return r;
}

export async function reintentar(mensajeId: string) {
  const sesion = await requerirSesion();
  if (!sesion.puede("negocio.editar")) return { ok: false as const, mensaje: "No tienes permiso." };
  if (!z.uuid().safeParse(mensajeId).success) return { ok: false as const, mensaje: "Datos inválidos." };
  const r = await reintentarMensaje(sesion.negocio.id, mensajeId);
  revalidatePath("/configuracion/whatsapp");
  return r;
}

export async function guardarAvisos(avisos: string[]) {
  const sesion = await requerirSesion();
  if (!sesion.puede("negocio.editar")) return { ok: false as const, mensaje: "No tienes permiso para cambiar la configuración." };
  const datos = z.array(z.enum(CLAVES_PLANTILLAS)).max(10).safeParse(avisos);
  if (!datos.success) return { ok: false as const, mensaje: "Datos inválidos." };
  const unicos = [...new Set(datos.data)];
  await db.update(t.negocio).set({ avisosWhatsapp: unicos }).where(eq(t.negocio.id, sesion.negocio.id));
  await registrar(sesion, "editar", "negocio", sesion.negocio.id, { avisosWhatsapp: unicos });
  revalidatePath("/configuracion/whatsapp");
  return { ok: true as const };
}
