import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Almacenamiento de imágenes. En desarrollo van a .data/archivos; para producción
// se cambia este módulo por Supabase Storage sin tocar el resto del código.
const CARPETA = path.join(process.cwd(), ".data", "archivos");
const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_BYTES = 3 * 1024 * 1024;
export const NOMBRE_VALIDO = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export function validarImagen(archivo: File): string | null {
  if (!TIPOS[archivo.type]) return "Usa una imagen JPG, PNG o WebP.";
  if (archivo.size > MAX_BYTES) return "La imagen pesa más de 3 MB.";
  return null;
}

/** Guarda la imagen y regresa su nombre, que es lo que se guarda en la base. */
export async function guardarImagen(archivo: File) {
  const nombre = `${randomUUID()}.${TIPOS[archivo.type]}`;
  await mkdir(CARPETA, { recursive: true });
  await writeFile(path.join(CARPETA, nombre), Buffer.from(await archivo.arrayBuffer()));
  return nombre;
}

export async function leerArchivo(nombre: string) {
  if (!NOMBRE_VALIDO.test(nombre)) return null;
  try {
    return await readFile(path.join(CARPETA, nombre));
  } catch {
    return null;
  }
}

export const urlArchivo = (nombre: string | null | undefined) => (nombre ? `/archivos/${nombre}` : null);
