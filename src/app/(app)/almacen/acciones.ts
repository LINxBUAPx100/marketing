"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { registrarTraspaso } from "@/lib/almacen/servidor";
import { requerirSesion } from "@/lib/auth";

const Articulos = z
  .array(
    z.object({
      tipo: z.enum(["insumo", "producto"]),
      id: z.uuid(),
      cantidad: z.number().positive({ error: "Cada cantidad debe ser mayor que cero." }).max(10_000_000),
    }),
  )
  .min(1, { error: "Agrega al menos un artículo." })
  .max(100);

export async function guardarTraspaso(entrada: { origenId: string; destinoId: string; notas: string | null; partidas: z.input<typeof Articulos> }) {
  const sesion = await requerirSesion();
  if (!sesion.puede("almacen.traspasar")) return { ok: false as const, mensaje: "No tienes permiso para traspasar." };
  const datos = z.object({ origenId: z.uuid(), destinoId: z.uuid(), notas: z.string().trim().max(300).nullable(), partidas: Articulos }).safeParse(entrada);
  if (!datos.success) return { ok: false as const, mensaje: datos.error.issues[0]?.message ?? "Revisa el traspaso." };
  const r = await registrarTraspaso(sesion, { ...datos.data, notas: datos.data.notas || null });
  if (r.ok) revalidatePath("/almacen", "layout");
  return r;
}
