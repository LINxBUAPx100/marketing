import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PgliteDatabase<typeof schema>;

export type Conexion = {
  db: Db;
  tipo: "pglite" | "postgres";
  cerrar: () => Promise<void>;
};

/**
 * DATABASE_URL con postgres:// → PostgreSQL real (Supabase en producción).
 * Sin URL o con una ruta → PGlite: PostgreSQL embebido guardado en esa carpeta.
 */
export function crearConexion(url = process.env.DATABASE_URL): Conexion {
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const client = postgres(url, { prepare: false });
    const db = drizzlePostgres({ client, schema, casing: "snake_case" });
    // Ambos drivers exponen la misma API de consultas.
    return { db: db as unknown as Db, tipo: "postgres", cerrar: () => client.end() };
  }
  const carpeta = url || "./.data/pglite";
  mkdirSync(carpeta, { recursive: true });
  const client = new PGlite(carpeta);
  const db = drizzlePglite({ client, schema, casing: "snake_case" });
  return { db, tipo: "pglite", cerrar: () => client.close() };
}
