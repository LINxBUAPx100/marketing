import { describe, expect, it } from "vitest";
import { comisionDe, precioPara, rebasaLimite, type ProductoPrecio } from "./precios";

// Volantes media carta, por millar: $850 público, $690 revendedor; más barato desde 5 y 10 millares.
const volantes: ProductoPrecio = {
  id: "vol",
  precio: 85000,
  precioRevendedor: 69000,
  volumen: [
    { desde: 5, precio: 78000, precioRevendedor: 64000 },
    { desde: 10, precio: 72000, precioRevendedor: null },
  ],
};
const publico = { tipoPrecio: "publico" as const, convenio: null };
const revendedor = { tipoPrecio: "revendedor" as const, convenio: null };

describe("precioPara", () => {
  it("precio de lista por debajo del primer escalón", () => {
    expect(precioPara(volantes, 4, publico)).toMatchObject({ precio: 85000, origen: "lista" });
    expect(precioPara(volantes, 1, revendedor)).toMatchObject({ precio: 69000, origen: "lista" });
  });
  it("toma el escalón más alto alcanzado", () => {
    expect(precioPara(volantes, 5, publico)).toMatchObject({ precio: 78000, origen: "volumen", desde: 5 });
    expect(precioPara(volantes, 12, publico)).toMatchObject({ precio: 72000, origen: "volumen", desde: 10 });
  });
  it("revendedor usa su columna del escalón, y si no la hay nunca paga más que su lista", () => {
    expect(precioPara(volantes, 6, revendedor)).toMatchObject({ precio: 64000, origen: "volumen" });
    // El escalón de 10 no tiene precio revendedor: $720 > $690 de su lista, así que se queda en lista.
    expect(precioPara(volantes, 10, revendedor)).toMatchObject({ precio: 69000, origen: "lista" });
  });
  it("el precio especial del convenio gana y no lleva descuento extra", () => {
    const r = precioPara(volantes, 20, { tipoPrecio: "publico", convenio: { descuentoBp: 1000, precios: { vol: 60000 } } });
    expect(r).toEqual({ precio: 60000, origen: "convenio", desde: null, conDescuentoConvenio: false });
  });
  it("el descuento general del convenio se aplica sobre lista o volumen", () => {
    const convenio = { descuentoBp: 1000, precios: {} };
    expect(precioPara(volantes, 1, { tipoPrecio: "publico", convenio }).precio).toBe(76500);
    expect(precioPara(volantes, 5, { tipoPrecio: "publico", convenio }).precio).toBe(70200);
  });
});

describe("comisiones y crédito", () => {
  it("comisión sobre la base sin IVA", () => {
    expect(comisionDe(146552, 300)).toBe(4397); // 3 % de $1,465.52
  });
  it("respeta el límite de crédito", () => {
    expect(rebasaLimite(400000, 150000, 500000)).toBe(true);
    expect(rebasaLimite(400000, 100000, 500000)).toBe(false);
    expect(rebasaLimite(400000, 999999, null)).toBe(false);
    expect(rebasaLimite(900000, 0, 500000)).toBe(false);
  });
});
