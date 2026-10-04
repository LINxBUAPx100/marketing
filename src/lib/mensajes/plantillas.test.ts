import { describe, expect, it } from "vitest";
import { PLANTILLAS, limpiarVariable, textoPlantilla } from "./plantillas";

describe("plantillas de WhatsApp", () => {
  it("cada plantilla usa exactamente sus variables, en orden", () => {
    for (const p of PLANTILLAS) {
      const usadas = [...p.cuerpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      expect(usadas).toEqual(p.variables.map((_, i) => i + 1));
    }
  });

  it("sustituye las variables", () => {
    expect(textoPlantilla("recordatorio_saldo", ["Ana", "$150.00", "Imprenta Demo"])).toBe(
      "Hola Ana, te recordamos que tienes un saldo pendiente de $150.00 con Imprenta Demo. Si ya pagaste, ignora este mensaje. ¡Gracias!",
    );
  });

  it("limpia lo que Meta no acepta en una variable", () => {
    expect(limpiarVariable("línea 1\nlínea 2")).toBe("línea 1 línea 2");
    expect(limpiarVariable("a      b")).toBe("a   b");
    expect(limpiarVariable("")).toBe("-");
    expect(limpiarVariable(null)).toBe("-");
  });
});
