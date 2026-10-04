"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requerirSesion } from "@/lib/auth";
import { pagarComisiones } from "@/lib/comisiones/servidor";
import { datosDe, erroresDe, vacioANull, type EstadoFormulario } from "@/lib/formulario";

export async function pagar(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("comisiones.pagar")) return { mensaje: "No tienes permiso para pagar comisiones." };
  const datos = z
    .object({
      usuarioId: z.uuid(),
      desdeCaja: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
      notas: z.preprocess(vacioANull, z.string().trim().max(300).nullable()),
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const r = await pagarComisiones(sesion, datos.data.usuarioId, datos.data);
  if (!r.ok) return { mensaje: r.mensaje };
  revalidatePath("/comisiones", "layout");
  revalidatePath("/caja");
  return { ok: true, mensaje: `Se pagaron ${r.comisiones} comisiones.` };
}
