// Restaura un respaldo: npm run db:restaurar -- .data/respaldos/respaldo-2026-10-03-2245.json.gz [--reemplazar]
// Detén el servidor antes. La base debe estar migrada (npm run db:migrar) a la misma versión del respaldo.
// Sin --reemplazar solo restaura sobre una base vacía; con --reemplazar borra lo actual (en una transacción).
import { readFile } from "node:fs/promises";
import { crearConexion } from "../src/db/conexion";
import { restaurarRespaldo } from "../src/lib/respaldos";

const archivo = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!archivo) {
  console.error("Indica el archivo: npm run db:restaurar -- ruta/al/respaldo.json.gz [--reemplazar]");
  process.exit(1);
}
const { db, tipo, cerrar } = crearConexion();
try {
  const resumen = await restaurarRespaldo(db, await readFile(archivo), { reemplazar: process.argv.includes("--reemplazar") });
  console.log(`Respaldo restaurado (${tipo}):`);
  for (const r of resumen) console.log(`  ${r.tabla}: ${r.filas}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await cerrar();
}
