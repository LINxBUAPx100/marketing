// Dinero en centavos y porcentajes en puntos base, para no arrastrar errores de redondeo.

const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export const formatoMoneda = (centavos: number) => moneda.format(centavos / 100);

/** "3.5" → 350 */
export const aPuntosBase = (porcentaje: number) => Math.round(porcentaje * 100);

/** 350 → "3.5 %" */
export const formatoPorcentaje = (bp: number) =>
  `${(bp / 100).toLocaleString("es-MX", { maximumFractionDigits: 2 })} %`;

const fecha = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

export const formatoFechaHora = (d: Date | string | null | undefined) => (d ? fecha.format(new Date(d)) : "—");

/** "1,234.50" o "$1234.5" → 123450. Devuelve NaN si no es un número. */
export function aCentavos(texto: unknown): number {
  if (typeof texto === "number") return Math.round(texto * 100);
  if (typeof texto !== "string") return NaN;
  const limpio = texto.replace(/[$,\s]/g, "");
  if (!/^-?\d*(\.\d+)?$/.test(limpio) || limpio === "" || limpio === "-") return NaN;
  // Aritmética de enteros: Number("1.005") * 100 da 100.49999… en punto flotante.
  const negativo = limpio.startsWith("-");
  const [entero, decimales = ""] = limpio.replace("-", "").split(".");
  const milesimas = Number((decimales + "000").slice(0, 3));
  const centavos = Number(entero || "0") * 100 + Math.round(milesimas / 10);
  return negativo ? -centavos : centavos;
}

/** 123450 → "1234.50", para rellenar inputs. */
export const centavosATexto = (centavos: number | null | undefined) =>
  centavos == null ? "" : (centavos / 100).toFixed(2);

const cantidadFormato = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });
export const formatoCantidad = (n: number) => cantidadFormato.format(n);

const soloFecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" });
export const formatoFecha = (d: Date | string | null | undefined) => (d ? soloFecha.format(new Date(d)) : "—");
