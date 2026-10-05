// Reglas de facturación CFDI 4.0. Funciones puras.

import { RFC_VALIDO } from "@/lib/sat";

export const RFC_PUBLICO_GENERAL = "XAXX010101000";

/** c_FormaPago del SAT para cada método de cobro del sistema. */
export const FORMA_PAGO: Record<string, string> = {
  efectivo: "01",
  cheque: "02",
  transferencia: "03",
  tarjeta: "04",
};
export const ETIQUETA_FORMA_PAGO: Record<string, string> = {
  "01": "01 Efectivo",
  "02": "02 Cheque nominativo",
  "03": "03 Transferencia electrónica",
  "04": "04 Tarjeta de crédito",
  "28": "28 Tarjeta de débito",
  "99": "99 Por definir",
};

export const MOTIVOS_CANCELACION = [
  ["01", "Comprobante emitido con errores con relación (se sustituye por otro)"],
  ["02", "Comprobante emitido con errores sin relación"],
  ["03", "No se llevó a cabo la operación"],
  ["04", "Operación nominativa relacionada en una factura global"],
] as const;

/**
 * PUE si ya se pagó todo (forma de pago: el método con más dinero cobrado).
 * PPD si queda saldo (forma "99 Por definir"; los pagos se amparan con complementos).
 */
export function formaYMetodo(total: number, pagos: { metodo: string; monto: number }[]) {
  const pagado = pagos.reduce((s, p) => s + p.monto, 0);
  if (pagado < total) return { metodoPago: "PPD" as const, formaPago: "99" };
  const porMetodo = new Map<string, number>();
  for (const p of pagos) porMetodo.set(p.metodo, (porMetodo.get(p.metodo) ?? 0) + p.monto);
  const principal = [...porMetodo].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { metodoPago: "PUE" as const, formaPago: FORMA_PAGO[principal ?? ""] ?? "99" };
}

const REGIMENES_MORALES = new Set(["601", "603", "620", "622", "623", "624", "626"]);
const REGIMENES_FISICAS = new Set(["605", "606", "607", "608", "610", "611", "612", "614", "615", "616", "621", "625", "626"]);

export type Receptor = { rfc: string | null; razonSocial: string | null; regimenFiscal: string | null; codigoPostal: string | null; usoCfdi: string | null };

/** Lo que le falta o sobra a los datos fiscales de un cliente para poder facturarle. */
export function erroresReceptor(r: Receptor): string[] {
  const errores: string[] = [];
  const rfc = r.rfc?.toUpperCase() ?? "";
  if (!RFC_VALIDO.test(rfc)) errores.push("RFC con formato válido");
  if (!r.razonSocial?.trim()) errores.push("razón social (como aparece en su constancia, sin «S.A. de C.V.»)");
  if (!r.codigoPostal || !/^\d{5}$/.test(r.codigoPostal)) errores.push("código postal fiscal de 5 dígitos");
  if (!r.regimenFiscal) errores.push("régimen fiscal");
  else if (RFC_VALIDO.test(rfc)) {
    const moral = rfc.length === 12;
    if (moral && !REGIMENES_MORALES.has(r.regimenFiscal)) errores.push("un régimen de persona moral (su RFC es de 12 caracteres)");
    if (!moral && !REGIMENES_FISICAS.has(r.regimenFiscal)) errores.push("un régimen de persona física (su RFC es de 13 caracteres)");
  }
  if (!r.usoCfdi) errores.push("uso de CFDI");
  else if (r.regimenFiscal === "616" && !["S01", "CP01"].includes(r.usoCfdi)) errores.push("uso de CFDI «S01 Sin efectos fiscales» (régimen 616)");
  return errores;
}

/** Parcialidad y saldos de un pago que se ampara con complemento. */
export function datosComplemento(totalFactura: number, previos: number[], monto: number) {
  const pagadoAntes = previos.reduce((s, m) => s + m, 0);
  const saldoAnterior = totalFactura - pagadoAntes;
  return { parcialidad: previos.length + 1, saldoAnterior, saldoInsoluto: Math.max(0, saldoAnterior - monto) };
}

/** Base del IVA de un importe que ya lo incluye, en centavos. */
export const baseSinIva = (importe: number, ivaBp: number) => Math.round((importe * 10000) / (10000 + ivaBp));
