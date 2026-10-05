import { describe, expect, it } from "vitest";
import { aCentavos } from "./numeros";

describe("aCentavos", () => {
  it("convierte pesos escritos de varias formas", () => {
    expect(aCentavos("1,234.50")).toBe(123450);
    expect(aCentavos("$ 99")).toBe(9900);
    expect(aCentavos("0.1")).toBe(10);
    expect(aCentavos("1.005")).toBe(101);
  });
  it("rechaza texto que no es número", () => {
    expect(aCentavos("abc")).toBeNaN();
    expect(aCentavos("")).toBeNaN();
    expect(aCentavos("1.2.3")).toBeNaN();
  });
});
