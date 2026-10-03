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
