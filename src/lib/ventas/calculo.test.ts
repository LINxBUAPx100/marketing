import { describe, expect, it } from "vitest";
import { calcularTotales, cambioDe, importePartida, validarPagos, validarPartida } from "./calculo";

const conIva = { ivaBp: 1600, preciosIncluyenIva: true };
const sinIva = { ivaBp: 1600, preciosIncluyenIva: false };

describe("calcularTotales", () => {
  it("desglosa el IVA cuando el precio ya lo incluye", () => {
    // 100 volantes a $1.16 = $116.00 → base $100.00 + IVA $16.00
    const t = calcularTotales([{ cantidad: 100, precioUnitario: 116, descuento: 0 }], conIva);
    expect(t).toEqual({ bruto: 11600, descuento: 0, subtotal: 10000, iva: 1600, total: 11600 });
  });

  it("suma el IVA cuando el precio no lo incluye", () => {
    const t = calcularTotales([{ cantidad: 2, precioUnitario: 5000, descuento: 0 }], sinIva);
    expect(t).toEqual({ bruto: 10000, descuento: 0, subtotal: 10000, iva: 1600, total: 11600 });
  });

  it("aplica descuentos antes del IVA", () => {
    const t = calcularTotales([{ cantidad: 1, precioUnitario: 10000, descuento: 1000 }], sinIva);
    expect(t.subtotal).toBe(9000);
    expect(t.iva).toBe(1440);
    expect(t.total).toBe(10440);
  });

  it("redondea cantidades fraccionarias al centavo (lona por m²)", () => {
    // 2.35 m² × $180.00 = $423.00
    expect(importePartida({ cantidad: 2.35, precioUnitario: 18000, descuento: 0 })).toBe(42300);
    // 1.333 m² × $99.99 = $133.29 (redondeado)
    expect(importePartida({ cantidad: 1.333, precioUnitario: 9999, descuento: 0 })).toBe(13329);
  });

  it("el subtotal más el IVA siempre da el total", () => {
    for (const precio of [1, 99, 1234, 99999]) {
      const t = calcularTotales([{ cantidad: 3, precioUnitario: precio, descuento: 0 }], conIva);
      expect(t.subtotal + t.iva).toBe(t.total);
    }
  });

  it("una venta sin partidas da cero", () => {
    expect(calcularTotales([], conIva).total).toBe(0);
  });
});

describe("validarPartida", () => {
  it("rechaza cantidad cero o negativa", () => {
    expect(validarPartida({ cantidad: 0, precioUnitario: 100, descuento: 0 })).not.toBeNull();
    expect(validarPartida({ cantidad: -1, precioUnitario: 100, descuento: 0 })).not.toBeNull();
  });
  it("rechaza un descuento mayor al importe", () => {
    expect(validarPartida({ cantidad: 1, precioUnitario: 100, descuento: 101 })).not.toBeNull();
  });
  it("acepta una partida normal", () => {
    expect(validarPartida({ cantidad: 1, precioUnitario: 100, descuento: 100 })).toBeNull();
  });
});

describe("pagos", () => {
  it("permite anticipos (pagar menos del total)", () => {
    expect(validarPagos([{ metodo: "efectivo", monto: 5000 }], 11600)).toBeNull();
  });
  it("no permite cobrar de más", () => {
    expect(validarPagos([{ metodo: "tarjeta", monto: 12000 }], 11600)).not.toBeNull();
  });
  it("combina métodos de pago", () => {
    const pagos = [
      { metodo: "efectivo", monto: 6000, recibido: 10000 },
      { metodo: "tarjeta", monto: 5600 },
    ];
    expect(validarPagos(pagos, 11600)).toBeNull();
    expect(cambioDe(pagos)).toBe(4000);
  });
  it("rechaza efectivo recibido menor al pago", () => {
    expect(validarPagos([{ metodo: "efectivo", monto: 5000, recibido: 4000 }], 5000)).not.toBeNull();
  });
});
