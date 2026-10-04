import { describe, expect, it } from "vitest";
import { baseSinIva, datosComplemento, erroresReceptor, formaYMetodo } from "./reglas";

describe("formaYMetodo", () => {
  it("PUE con la forma de pago con más dinero", () => {
    expect(
      formaYMetodo(100000, [
        { metodo: "efectivo", monto: 30000 },
        { metodo: "transferencia", monto: 70000 },
      ]),
    ).toEqual({ metodoPago: "PUE", formaPago: "03" });
  });
  it("PPD y 99 cuando queda saldo", () => {
    expect(formaYMetodo(100000, [{ metodo: "efectivo", monto: 50000 }])).toEqual({ metodoPago: "PPD", formaPago: "99" });
    expect(formaYMetodo(100000, [])).toEqual({ metodoPago: "PPD", formaPago: "99" });
  });
});

describe("erroresReceptor", () => {
  const moral = { rfc: "CBJ850101AB1", razonSocial: "COLEGIO BENITO JUAREZ", regimenFiscal: "603", codigoPostal: "72000", usoCfdi: "G03" };
  it("acepta datos completos", () => {
    expect(erroresReceptor(moral)).toEqual([]);
  });
  it("detecta régimen de persona física en un RFC de moral", () => {
    expect(erroresReceptor({ ...moral, regimenFiscal: "612" })).toHaveLength(1);
  });
  it("lista todo lo que falta", () => {
    expect(erroresReceptor({ rfc: null, razonSocial: null, regimenFiscal: null, codigoPostal: "720", usoCfdi: null })).toHaveLength(5);
  });
  it("régimen 616 solo permite uso S01", () => {
    expect(erroresReceptor({ rfc: "LOMA800101AB1", razonSocial: "MARIA LOPEZ", regimenFiscal: "616", codigoPostal: "72000", usoCfdi: "G03" })).toHaveLength(1);
  });
});

describe("complemento de pago", () => {
  it("numera parcialidades y calcula saldos", () => {
    expect(datosComplemento(116000, [], 50000)).toEqual({ parcialidad: 1, saldoAnterior: 116000, saldoInsoluto: 66000 });
    expect(datosComplemento(116000, [50000], 66000)).toEqual({ parcialidad: 2, saldoAnterior: 66000, saldoInsoluto: 0 });
  });
  it("base del IVA", () => {
    expect(baseSinIva(11600, 1600)).toBe(10000);
  });
});
