// Guarda un respaldo completo de la base en .data/respaldos (o RESPALDOS_DIR).
// Con PGlite, detén `npm run dev` antes de correrlo (o usa el botón en Configuración › Respaldos).
import { crearConexion } from "../src/db/conexion";
import { guardarRespaldo } from "../src/lib/respaldos-automaticos";

const { db, tipo, cerrar } = crearConexion();
const { nombre, bytes } = await guardarRespaldo(db);
await cerrar();
console.log(`Respaldo ${nombre} (${Math.round(bytes / 1024)} KB, ${tipo}).`);
