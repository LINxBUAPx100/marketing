import { describe, expect, it } from "vitest";
import { costoPorMil, desgasteConsumible, impresionesEnPeriodo, impresionesFantasma, validarLectura } from "./reglas";

const d = (iso: string) => new Date(iso);

describe("impresionesEnPeriodo", () => {
  const lecturas = [
    { valor: 10000, fecha: d("2026-10-01T15:00:00Z") },
    { valor: 10450, fecha: d("2026-10-02T00:30:00Z") },
    { valor: 10450, fecha: d("2026-10-02T15:00:00Z") },
    { valor: 11020, fecha: d("2026-10-03T00:30:00Z") },
  ];
  it("toma como base la última lectura antes del periodo", () => {
    // Día 2 en México (06:00 UTC del 2 a 06:00 UTC del 3).
    expect(impresionesEnPeriodo(lecturas, d("2026-10-02T06:00:00Z"), d("2026-10-03T06:00:00Z"))).toEqual({ desde: 10450, hasta: 11020, impresiones: 570 });
  });
  it("sin lectura previa usa la primera del periodo", () => {
    expect(impresionesEnPeriodo(lecturas, d("2026-09-30T00:00:00Z"), d("2026-10-02T06:00:00Z"))).toEqual({ desde: 10000, hasta: 10450, impresiones: 450 });
  });
  it("con una sola lectura no se puede medir", () => {
    expect(impresionesEnPeriodo([lecturas[0]], d("2026-09-30T00:00:00Z"), d("2026-10-05T00:00:00Z"))).toBeNull();
  });
});

describe("validarLectura", () => {
  it("rechaza lecturas menores a la anterior", () => {
    expect(validarLectura(9999, 10000)).not.toBeNull();
    expect(validarLectura(10000, 10000)).toBeNull();
    expect(validarLectura(5, null)).toBeNull();
  });
});

describe("impresionesFantasma", () => {
  it("lo que marca el contador menos lo vendido y las mermas", () => {
    expect(impresionesFantasma({ contador: 570, vendidas: 500, mermas: 20 })).toEqual({ fantasma: 50, porcentaje: 50 / 570 });
  });
  it("negativo cuando se vendió más de lo que marca el contador", () => {
    expect(impresionesFantasma({ contador: 100, vendidas: 120, mermas: 0 }).fantasma).toBe(-20);
  });
});

describe("desgasteConsumible", () => {
  it("calcula lo usado, el porcentaje y cuándo se acaba", () => {
    const r = desgasteConsumible({
      lecturaInstalacion: 10000,
      lecturaActual: 16000,
      rendimiento: 24000,
      instaladoEn: d("2026-09-03T12:00:00Z"),
      ahora: d("2026-10-03T12:00:00Z"),
    });
    expect(r.usado).toBe(6000);
    expect(r.porcentaje).toBe(0.25);
    expect(r.porDia).toBe(200);
    // Quedan 18,000 a 200 por día = 90 días.
    expect(r.seAcabaEn?.toISOString().slice(0, 10)).toBe("2027-01-01");
  });
});

describe("costoPorMil", () => {
  it("reparte el costo del consumible entre las impresiones que dio", () => {
    expect(costoPorMil(180000, 24000)).toBe(7500); // $1,800 / 24,000 = $75 por millar
    expect(costoPorMil(180000, 0)).toBeNull();
  });
});
