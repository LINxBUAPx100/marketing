import { describe, expect, it } from "vitest";
import { consumoDeInsumos, costoPartida, costoReceta, estadoCuentaPorPagar, ingresoSinIva, utilidad } from "./reglas";

// 1 millar de volantes media carta: 250 hojas carta (4 por hoja) + 20 ml de tinta.
const recetaVolantes = [
  { insumoId: "hoja", cantidad: 250, costoInsumo: 72.5 }, // $0.725 por hoja couché
  { insumoId: "tinta", cantidad: 20, costoInsumo: 150 }, // $1.50 por ml
];

describe("costos por receta", () => {
  it("suma insumo por insumo", () => {
    expect(costoReceta(recetaVolantes)).toBe(250 * 72.5 + 20 * 150); // 21125 centavos = $211.25
  });
  it("la partida multiplica por lo vendido y redondea al centavo", () => {
    expect(costoPartida(2, recetaVolantes, null)).toBe(42250);
    expect(costoPartida(0.5, [{ insumoId: "lona", cantidad: 1.1, costoInsumo: 3333.3 }], null)).toBe(1833);
  });
  it("sin receta usa el costo capturado del producto; sin nada, null", () => {
    expect(costoPartida(3, [], 9200)).toBe(27600);
    expect(costoPartida(3, [], null)).toBeNull();
  });
});

describe("consumoDeInsumos", () => {
  it("junta el consumo de varias partidas y redondea a milésimas", () => {
    const recetas = new Map([
      ["volantes", [{ insumoId: "hoja", cantidad: 250, costoInsumo: 0 }]],
      ["lona", [{ insumoId: "lona", cantidad: 1.1, costoInsumo: 0 }]],
    ]);
    const consumo = consumoDeInsumos(
      [
        { productoId: "volantes", cantidad: 2 },
        { productoId: "volantes", cantidad: 1 },
        { productoId: "lona", cantidad: 2.35 },
        { productoId: null, cantidad: 5 },
      ],
      recetas,
    );
    expect(consumo.get("hoja")).toBe(750);
    expect(consumo.get("lona")).toBe(2.585);
    expect(consumo.size).toBe(2);
  });
});

describe("utilidad", () => {
  it("quita el IVA cuando el precio lo incluye", () => {
    expect(ingresoSinIva(11600, { ivaBp: 1600, preciosIncluyenIva: true })).toBe(10000);
    expect(ingresoSinIva(10000, { ivaBp: 1600, preciosIncluyenIva: false })).toBe(10000);
  });
  it("calcula utilidad y margen", () => {
    expect(utilidad(10000, 4000)).toEqual({ utilidad: 6000, margen: 0.6 });
    expect(utilidad(10000, null)).toEqual({ utilidad: null, margen: null });
  });
});

describe("estadoCuentaPorPagar", () => {
  const ahora = new Date("2026-10-03T16:00:00Z");
  const base = { total: 50000, pagado: 0, estado: "activa" as const };
  it("vencida, por vencer y al corriente según la fecha", () => {
    expect(estadoCuentaPorPagar({ ...base, vencimiento: new Date("2026-10-01T00:00:00Z") }, ahora)).toBe("vencida");
    expect(estadoCuentaPorPagar({ ...base, vencimiento: new Date("2026-10-08T00:00:00Z") }, ahora)).toBe("por-vencer");
    expect(estadoCuentaPorPagar({ ...base, vencimiento: new Date("2026-11-01T00:00:00Z") }, ahora)).toBe("al-corriente");
  });
  it("pagada aunque esté vencida", () => {
    expect(estadoCuentaPorPagar({ ...base, pagado: 50000, vencimiento: new Date("2026-09-01T00:00:00Z") }, ahora)).toBe("pagada");
  });
});
