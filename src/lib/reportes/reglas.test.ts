import { describe, expect, it } from "vitest";
import { diasEntre, participacion, periodoAnterior, promedio, serieDiaria, variacion } from "./reglas";

describe("reportes", () => {
  it("lista los días del periodo, cruzando de mes", () => {
    expect(diasEntre("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(diasEntre("2026-10-02", "2026-10-01")).toEqual([]);
  });

  it("rellena días sin ventas", () => {
    const serie = serieDiaria("2026-10-01", "2026-10-03", [{ dia: "2026-10-02", total: 500, ventas: 2 }], { total: 0, ventas: 0 });
    expect(serie).toEqual([
      { dia: "2026-10-01", total: 0, ventas: 0 },
      { dia: "2026-10-02", total: 500, ventas: 2 },
      { dia: "2026-10-03", total: 0, ventas: 0 },
    ]);
  });

  it("calcula el periodo anterior de la misma duración", () => {
    expect(periodoAnterior("2026-10-01", "2026-10-31")).toEqual({ desde: "2026-08-31", hasta: "2026-09-30" });
    expect(periodoAnterior("2026-10-03", "2026-10-03")).toEqual({ desde: "2026-10-02", hasta: "2026-10-02" });
  });

  it("compara contra el periodo anterior", () => {
    expect(variacion(1100, 1000)).toBe(1000);
    expect(variacion(500, 1000)).toBe(-5000);
    expect(variacion(500, 0)).toBeNull();
  });

  it("promedia y reparte sin dividir entre cero", () => {
    expect(promedio(1000, 3)).toBe(333);
    expect(promedio(1000, 0)).toBe(0);
    expect(participacion(250, 1000)).toBe(2500);
    expect(participacion(1, 0)).toBe(0);
  });
});
