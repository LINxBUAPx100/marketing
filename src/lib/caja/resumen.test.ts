import { describe, expect, it } from "vitest";
import { resumirCaja } from "./resumen";

describe("resumirCaja", () => {
  it("calcula el efectivo esperado con fondo, cobros, ingresos y gastos", () => {
    const r = resumirCaja(
      [
        { metodo: "efectivo", monto: 50000 },
        { metodo: "tarjeta", monto: 30000 },
        { metodo: "efectivo", monto: 11600 },
      ],
      [
        { tipo: "fondo", metodo: "efectivo", monto: 100000, categoria: "Fondo" },
        { tipo: "egreso", metodo: "efectivo", monto: 25000, categoria: "Papelería" },
        { tipo: "egreso", metodo: "transferencia", monto: 80000, categoria: "Renta" },
        { tipo: "ingreso", metodo: "efectivo", monto: 5000, categoria: "Otro" },
      ],
    );
    // 1000 + 500 + 116 + 50 − 250 = 1416 pesos
    expect(r.efectivoEsperado).toBe(141600);
    expect(r.totalCobros).toBe(91600);
    expect(r.cobrosPorMetodo.tarjeta).toBe(30000);
    expect(r.totalEgresos).toBe(105000);
    expect(r.egresosPorCategoria).toEqual({ "Papelería": 25000, Renta: 80000 });
  });

  it("los pagos con tarjeta no cambian el efectivo esperado", () => {
    const r = resumirCaja([{ metodo: "tarjeta", monto: 99900 }], []);
    expect(r.efectivoEsperado).toBe(0);
  });
});
