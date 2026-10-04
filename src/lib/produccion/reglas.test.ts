import { describe, expect, it } from "vitest";
import { estadoCotizacion, formatoDuracion, tiemposPorEtapa, urgencia } from "./reglas";

// Sábado 3 de octubre de 2026, 10:00 en México (16:00 UTC).
const ahora = new Date("2026-10-03T16:00:00Z");

describe("urgencia", () => {
  it("marca atrasada una fecha que ya pasó", () => {
    expect(urgencia(new Date("2026-10-03T15:00:00Z"), ahora)).toBe("atrasada");
  });
  it("vence hoy si es más tarde el mismo día en México", () => {
    expect(urgencia(new Date("2026-10-04T05:30:00Z"), ahora)).toBe("hoy"); // 23:30 del día 3 en México
  });
  it("vence mañana", () => {
    expect(urgencia(new Date("2026-10-04T23:00:00Z"), ahora)).toBe("manana");
  });
  it("a tiempo con más margen", () => {
    expect(urgencia(new Date("2026-10-07T23:00:00Z"), ahora)).toBe("a-tiempo");
  });
  it("sin fecha", () => {
    expect(urgencia(null, ahora)).toBe("sin-fecha");
  });
});

describe("tiemposPorEtapa", () => {
  const h = (horas: number) => new Date(ahora.getTime() + horas * 3_600_000);

  it("mide cuánto estuvo cada orden en cada etapa y promedia", () => {
    const tiempos = tiemposPorEtapa(
      [
        { ordenId: "A", etapaId: "diseno", creadoEn: h(0) },
        { ordenId: "A", etapaId: "impresion", creadoEn: h(2) },
        { ordenId: "A", etapaId: "listo", creadoEn: h(5) },
        { ordenId: "B", etapaId: "diseno", creadoEn: h(0) },
        { ordenId: "B", etapaId: "impresion", creadoEn: h(4) },
        { ordenId: "B", etapaId: "listo", creadoEn: h(5) },
      ],
      h(6),
    );
    expect(tiempos.get("diseno")).toEqual({ promedioHoras: 3, ordenes: 2 });
    expect(tiempos.get("impresion")).toEqual({ promedioHoras: 2, ordenes: 2 });
  });

  it("un cambio de responsable no reinicia el tiempo de la etapa", () => {
    const tiempos = tiemposPorEtapa(
      [
        { ordenId: "A", etapaId: "diseno", creadoEn: h(0) },
        { ordenId: "A", etapaId: "diseno", creadoEn: h(1) },
        { ordenId: "A", etapaId: "impresion", creadoEn: h(3) },
      ],
      h(4),
    );
    expect(tiempos.get("diseno")?.promedioHoras).toBe(3);
    expect(tiempos.get("impresion")?.promedioHoras).toBe(1);
  });
});

describe("formatoDuracion", () => {
  it("usa minutos, horas o días", () => {
    expect(formatoDuracion(0.25)).toBe("15 min");
    expect(formatoDuracion(5.4)).toBe("5 h");
    expect(formatoDuracion(52)).toBe("2 d 4 h");
    expect(formatoDuracion(48)).toBe("2 d");
  });
});

describe("estadoCotizacion", () => {
  it("una cotización abierta con vigencia pasada está vencida", () => {
    expect(estadoCotizacion({ estado: "abierta", vigenciaHasta: new Date("2026-10-01T00:00:00Z") }, ahora)).toBe("vencida");
  });
  it("una aceptada no se vence", () => {
    expect(estadoCotizacion({ estado: "aceptada", vigenciaHasta: new Date("2026-10-01T00:00:00Z") }, ahora)).toBe("aceptada");
  });
});
