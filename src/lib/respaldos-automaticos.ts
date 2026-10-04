import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "@/db/conexion";
import { generarRespaldo } from "./respaldos";

// Respaldos guardados en disco: .data/respaldos (o RESPALDOS_DIR). El servidor crea uno al día
// y conserva los últimos RESPALDOS_CONSERVAR (30 por omisión).

export const carpetaRespaldos = () => path.resolve(process.env.RESPALDOS_DIR || "./.data/respaldos");
const conservar = () => Math.max(1, Number(process.env.RESPALDOS_CONSERVAR) || 30);
export const NOMBRE_RESPALDO = /^respaldo-\d{4}-\d{2}-\d{2}-\d{4}\.json\.gz$/;

/** "respaldo-2026-10-03-2245.json.gz" con la hora del centro de México. */
export function nombreRespaldo(fecha = new Date()) {
  const local = new Date(fecha.getTime() - 6 * 3_600_000).toISOString();
  return `respaldo-${local.slice(0, 10)}-${local.slice(11, 13)}${local.slice(14, 16)}.json.gz`;
}

export async function listarRespaldos() {
  const carpeta = carpetaRespaldos();
  const nombres = await readdir(carpeta).catch(() => [] as string[]);
  const archivos = await Promise.all(
    nombres.filter((n) => NOMBRE_RESPALDO.test(n)).map(async (nombre) => ({ nombre, ...(await stat(path.join(carpeta, nombre)).then((s) => ({ bytes: s.size, fecha: s.mtime }))) })),
  );
  return archivos.sort((a, b) => b.nombre.localeCompare(a.nombre));
}

export async function guardarRespaldo(db: Db) {
  const carpeta = carpetaRespaldos();
  await mkdir(carpeta, { recursive: true });
  const nombre = nombreRespaldo();
  const archivo = await generarRespaldo(db);
  await writeFile(path.join(carpeta, nombre), archivo);
  // Borra los más viejos.
  const todos = await listarRespaldos();
  for (const viejo of todos.slice(conservar())) await unlink(path.join(carpeta, viejo.nombre)).catch(() => {});
  return { nombre, bytes: archivo.length };
}

/** Crea el respaldo del día si todavía no existe. */
export async function respaldoDelDia(db: Db) {
  const hoy = nombreRespaldo().slice(0, "respaldo-2026-10-03".length);
  const existentes = await listarRespaldos();
  if (existentes.some((r) => r.nombre.startsWith(hoy))) return null;
  return guardarRespaldo(db);
}
