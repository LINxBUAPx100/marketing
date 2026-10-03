// Aplica las migraciones de ./drizzle. Con PGlite, detén `npm run dev` antes de correrlo.
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { crearConexion } from "../src/db/conexion";

const { db, tipo, cerrar } = crearConexion();
const opciones = { migrationsFolder: "./drizzle" };

if (tipo === "pglite") await migratePglite(db, opciones);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
else await migratePostgres(db as any, opciones);

await cerrar();
console.log(`Migraciones aplicadas (${tipo}).`);
