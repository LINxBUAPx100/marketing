import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { fechaExcel, hoja, letraColumna, libroExcel } from "./excel";

/** Lee las entradas de un .zip recorriendo los encabezados locales. */
function leerZip(b: Buffer) {
  const archivos = new Map<string, string>();
  let i = 0;
  while (b.readUInt32LE(i) === 0x04034b50) {
    const tam = b.readUInt32LE(i + 18);
    const largoNombre = b.readUInt16LE(i + 26);
    const extra = b.readUInt16LE(i + 28);
    const nombre = b.toString("utf8", i + 30, i + 30 + largoNombre);
    const inicio = i + 30 + largoNombre + extra;
    archivos.set(nombre, inflateRawSync(b.subarray(inicio, inicio + tam)).toString("utf8"));
    i = inicio + tam;
  }
  return archivos;
}

describe("excel", () => {
  it("nombra columnas como Excel", () => {
    expect([0, 25, 26, 27, 701, 702].map(letraColumna)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("convierte fechas a número de serie en hora de México", () => {
    // 1 de enero de 2026, 00:00 en México = 06:00 UTC.
    expect(fechaExcel(new Date("2026-01-01T06:00:00Z"))).toBe(46023);
  });

  it("genera un libro con encabezados, dinero y texto escapado", () => {
    const libro = libroExcel([
      hoja({
        nombre: "Clientes/2026",
        columnas: [
          { titulo: "Nombre", valor: (f: { nombre: string; saldo: number }) => f.nombre },
          { titulo: "Saldo", valor: (f) => f.saldo, tipo: "dinero" },
        ],
        filas: [
          { nombre: "Papelería <La Única> & Cía", saldo: 12345 },
          { nombre: "Sin saldo", saldo: 0 },
        ],
      }),
    ]);
    const archivos = leerZip(libro);
    expect([...archivos.keys()]).toContain("xl/worksheets/sheet1.xml");
    expect(archivos.get("xl/workbook.xml")).toContain('name="Clientes 2026"');
    const hoja1 = archivos.get("xl/worksheets/sheet1.xml")!;
    expect(hoja1).toContain("Papelería &lt;La Única&gt; &amp; Cía");
    expect(hoja1).toContain('<c r="B2" s="2"><v>123.45</v></c>');
    expect(hoja1).toContain('<autoFilter ref="A1:B3"/>');
  });
});
