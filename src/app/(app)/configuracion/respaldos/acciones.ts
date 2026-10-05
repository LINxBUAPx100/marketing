"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { guardarRespaldo } from "@/lib/respaldos-automaticos";

export async function respaldarAhora() {
  const sesion = await requerirSesion();
  if (!sesion.puede("respaldos.ver")) return { ok: false as const, mensaje: "No tienes permiso para respaldar." };
  try {
    const r = await guardarRespaldo(db);
    await registrar(sesion, "crear", "respaldo", null, { nombre: r.nombre });
    revalidatePath("/configuracion/respaldos");
    return { ok: true as const, nombre: r.nombre };
  } catch (e) {
    console.error(e);
    return { ok: false as const, mensaje: "No se pudo crear el respaldo. Revisa que la carpeta de respaldos se pueda escribir." };
  }
}
