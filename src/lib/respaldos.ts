import { gunzipSync, gzipSync } from "node:zlib";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/conexion";

// Respaldo lógico de toda la base: cada tabla como JSON, comprimido con gzip.
// Funciona igual con PGlite y con PostgreSQL. Para restaurar, la base debe tener
// las mismas migraciones que cuando se respaldó (se revisa con la última migración).

export type Respaldo = {
  formato: "imprenta-respaldo";
  version: 1;
  creadoEn: string;
  /** Hash de la última migración aplicada. */
  migracion: string | null;
  tablas: Record<string, unknown[]>;
};

const filasDe = <T,>(r: unknown) => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];

/** Tablas del esquema public ordenadas para insertar: primero las que otras referencian. */
async function tablasEnOrden(db: Db) {
  const tablas = filasDe<{ nombre: string }>(
    await db.execute(sql`select table_name as nombre from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`),
  ).map((t) => t.nombre);
  const llaves = filasDe<{ tabla: string; referida: string }>(
    await db.execute(sql`
      select c.conrelid::regclass::text as tabla, c.confrelid::regclass::text as referida
      from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where c.contype = 'f' and n.nspname = 'public'`),
  );
  const limpiar = (n: string) => n.replace(/^public\./, "").replace(/"/g, "");
  const depende = new Map(tablas.map((t) => [t, new Set<string>()]));
  for (const k of llaves) {
    const tabla = limpiar(k.tabla);
    const referida = limpiar(k.referida);
    if (tabla !== referida) depende.get(tabla)?.add(referida);
  }
  const orden: string[] = [];
  const visitadas = new Set<string>();
  const visitar = (t: string, camino: Set<string>) => {
    if (visitadas.has(t) || camino.has(t)) return;
    camino.add(t);
    for (const d of depende.get(t) ?? []) visitar(d, camino);
    camino.delete(t);
    visitadas.add(t);
    orden.push(t);
  };
  for (const t of tablas) visitar(t, new Set());
  return orden;
}

async function ultimaMigracion(db: Db) {
  try {
    const [m] = filasDe<{ hash: string }>(await db.execute(sql`select hash from drizzle.__drizzle_migrations order by created_at desc limit 1`));
    return m?.hash ?? null;
  } catch {
    return null;
  }
}

export async function generarRespaldo(db: Db): Promise<Buffer> {
  const respaldo: Respaldo = { formato: "imprenta-respaldo", version: 1, creadoEn: new Date().toISOString(), migracion: await ultimaMigracion(db), tablas: {} };
  // En una sola transacción para que el respaldo sea consistente aunque haya ventas en curso.
  await db.transaction(async (tx) => {
    for (const tabla of await tablasEnOrden(tx as unknown as Db)) {
      const [r] = filasDe<{ datos: unknown[] | string }>(await tx.execute(sql`select coalesce(json_agg(x), '[]'::json) as datos from ${sql.identifier(tabla)} x`));
      respaldo.tablas[tabla] = typeof r.datos === "string" ? JSON.parse(r.datos) : r.datos;
    }
  });
  return gzipSync(JSON.stringify(respaldo));
}

export function leerRespaldo(archivo: Buffer): Respaldo {
  let respaldo: Respaldo;
  try {
    respaldo = JSON.parse(gunzipSync(archivo).toString("utf8"));
  } catch {
    throw new Error("El archivo no es un respaldo válido.");
  }
  if (respaldo?.formato !== "imprenta-respaldo" || respaldo.version !== 1 || typeof respaldo.tablas !== "object") throw new Error("El archivo no es un respaldo de este sistema.");
  return respaldo;
}

/** Resumen para mostrar antes de restaurar. */
export function resumenRespaldo(r: Respaldo) {
  return Object.entries(r.tablas)
    .filter(([, filas]) => filas.length)
    .map(([tabla, filas]) => ({ tabla, filas: filas.length }));
}

/**
 * Restaura un respaldo. Sin `reemplazar` solo funciona sobre una base vacía;
 * con `reemplazar` borra todo lo actual dentro de la misma transacción (si algo falla, no se pierde nada).
 */
export async function restaurarRespaldo(db: Db, archivo: Buffer, { reemplazar = false } = {}) {
  const respaldo = leerRespaldo(archivo);
  const migracion = await ultimaMigracion(db);
  if (respaldo.migracion && migracion !== respaldo.migracion) {
    throw new Error("La base tiene otra versión de migraciones que el respaldo. Corre `npm run db:migrar` con la versión del sistema que generó el respaldo.");
  }
  const orden = await tablasEnOrden(db);
  const desconocidas = Object.keys(respaldo.tablas).filter((t) => !orden.includes(t));
  if (desconocidas.length) throw new Error(`El respaldo trae tablas que esta base no tiene: ${desconocidas.join(", ")}.`);

  await db.transaction(async (tx) => {
    const [{ n }] = filasDe<{ n: number }>(await tx.execute(sql`select count(*)::int as n from negocio`));
    if (n > 0 && !reemplazar) throw new Error("La base ya tiene datos. Usa la opción de reemplazar para sobrescribirlos.");
    if (n > 0) await tx.execute(sql`truncate table ${sql.join(orden.map((t) => sql.identifier(t)), sql`, `)} restart identity cascade`);
    for (const tabla of orden) {
      const filas = respaldo.tablas[tabla] ?? [];
      for (let i = 0; i < filas.length; i += 500) {
        const lote = JSON.stringify(filas.slice(i, i + 500));
        await tx.execute(sql`insert into ${sql.identifier(tabla)} select * from json_populate_recordset(null::${sql.identifier(tabla)}, ${lote}::json)`);
      }
    }
  });
  return resumenRespaldo(respaldo);
}
