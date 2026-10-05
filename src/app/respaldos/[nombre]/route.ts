import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { obtenerSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { generarRespaldo } from "@/lib/respaldos";
import { carpetaRespaldos, NOMBRE_RESPALDO, nombreRespaldo } from "@/lib/respaldos-automaticos";

// /respaldos/actual genera uno al momento; /respaldos/respaldo-AAAA-MM-DD-HHMM.json.gz baja uno guardado.
export async function GET(_: Request, { params }: RouteContext<"/respaldos/[nombre]">) {
  const sesion = await obtenerSesion();
  if (!sesion || !sesion.puede("respaldos.ver")) return new Response("No autorizado", { status: 401 });
  const { nombre } = await params;

  let archivo: Buffer;
  let descarga: string;
  if (nombre === "actual") {
    archivo = await generarRespaldo(db);
    descarga = nombreRespaldo();
  } else {
    if (!NOMBRE_RESPALDO.test(nombre)) return new Response("No encontrado", { status: 404 });
    const leido = await readFile(path.join(carpetaRespaldos(), nombre)).catch(() => null);
    if (!leido) return new Response("No encontrado", { status: 404 });
    archivo = leido;
    descarga = nombre;
  }
  await registrar(sesion, "descargar", "respaldo", null, { nombre: descarga });
  return new Response(new Uint8Array(archivo), {
    headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${descarga}"`, "Cache-Control": "no-store" },
  });
}
