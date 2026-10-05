import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { Db } from "@/db/conexion";
import { crearNegocioInicial } from "@/db/inicial";
import * as schema from "@/db/schema";
import { generarRespaldo, leerRespaldo, restaurarRespaldo } from "./respaldos";

async function baseNueva() {
  const db = drizzle({ client: new PGlite(), schema, casing: "snake_case" }) as Db;
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

async function conDatos() {
  const db = await baseNueva();
  const { negocio } = await crearNegocioInicial(db, { negocio: "Imprenta Prueba", sucursal: "Centro", admin: { nombre: "Admin", correo: "admin@prueba.test", password: "prueba123" } });
  // Tipos delicados: arreglos de texto, jsonb, numéricos con decimales, fechas y textos con comillas.
  await db.update(schema.negocio).set({ avisosWhatsapp: ["pedido_listo"] }).where(eq(schema.negocio.id, negocio.id));
  await db.insert(schema.cliente).values({ negocioId: negocio.id, nombre: `Papelería "La 'Única'" & Cía\nSegunda línea`, telefono: "2221234567" });
  await db.insert(schema.insumo).values({ negocioId: negocio.id, nombre: "Papel bond", unidad: "hoja", costo: 72.5, existenciaMinima: 0.125 });
  return db;
}

const tablasDe = (archivo: Buffer) => leerRespaldo(archivo).tablas;

describe("respaldos", () => {
  it("restaura una base idéntica", { timeout: 60_000 }, async () => {
    const origen = await conDatos();
    const archivo = await generarRespaldo(origen);
    expect(JSON.parse(gunzipSync(archivo).toString()).formato).toBe("imprenta-respaldo");

    const destino = await baseNueva();
    const resumen = await restaurarRespaldo(destino, archivo);
    expect(resumen.find((r) => r.tabla === "cliente")?.filas).toBe(1);

    // Respaldar la base restaurada da exactamente los mismos datos.
    expect(tablasDe(await generarRespaldo(destino))).toEqual(tablasDe(archivo));
    const [insumo] = await destino.select().from(schema.insumo);
    expect(insumo.costo).toBe(72.5);
    const [n] = await destino.select().from(schema.negocio);
    expect(n.avisosWhatsapp).toEqual(["pedido_listo"]);
  });

  it("no pisa una base con datos si no se pide reemplazar", { timeout: 60_000 }, async () => {
    const origen = await conDatos();
    const archivo = await generarRespaldo(origen);
    const otra = await conDatos();
    await expect(restaurarRespaldo(otra, archivo)).rejects.toThrow(/ya tiene datos/);

    await restaurarRespaldo(otra, archivo, { reemplazar: true });
    expect(tablasDe(await generarRespaldo(otra))).toEqual(tablasDe(archivo));
  });

  it("rechaza archivos que no son respaldos", () => {
    expect(() => leerRespaldo(Buffer.from("hola"))).toThrow(/no es un respaldo/);
  });
});
