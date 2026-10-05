// Resumen de un periodo de caja (lo que va desde el último corte). Función pura.

export const METODOS = ["efectivo", "tarjeta", "transferencia", "cheque"] as const;
export type Metodo = (typeof METODOS)[number];

export const ETIQUETA_METODO: Record<Metodo, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia o depósito",
  cheque: "Cheque",
};

export type PagoPeriodo = { metodo: Metodo; monto: number };
export type MovimientoPeriodo = { tipo: "ingreso" | "egreso" | "fondo"; metodo: Metodo; monto: number; categoria: string };

export type ResumenCaja = {
  fondo: number;
  cobrosPorMetodo: Record<Metodo, number>;
  totalCobros: number;
  ingresosPorMetodo: Record<Metodo, number>;
  egresosPorMetodo: Record<Metodo, number>;
  egresosPorCategoria: Record<string, number>;
  totalIngresos: number;
  totalEgresos: number;
  /** Efectivo que debería haber físicamente en la caja. */
  efectivoEsperado: number;
};

const ceros = () => Object.fromEntries(METODOS.map((m) => [m, 0])) as Record<Metodo, number>;

export function resumirCaja(pagos: PagoPeriodo[], movimientos: MovimientoPeriodo[]): ResumenCaja {
  const cobrosPorMetodo = ceros();
  const ingresosPorMetodo = ceros();
  const egresosPorMetodo = ceros();
  const egresosPorCategoria: Record<string, number> = {};
  let fondo = 0;

  for (const p of pagos) cobrosPorMetodo[p.metodo] += p.monto;
  for (const m of movimientos) {
    if (m.tipo === "fondo") fondo += m.monto;
    else if (m.tipo === "ingreso") ingresosPorMetodo[m.metodo] += m.monto;
    else {
      egresosPorMetodo[m.metodo] += m.monto;
      egresosPorCategoria[m.categoria] = (egresosPorCategoria[m.categoria] ?? 0) + m.monto;
    }
  }

  const suma = (r: Record<Metodo, number>) => METODOS.reduce((s, m) => s + r[m], 0);
  return {
    fondo,
    cobrosPorMetodo,
    totalCobros: suma(cobrosPorMetodo),
    ingresosPorMetodo,
    egresosPorMetodo,
    egresosPorCategoria,
    totalIngresos: suma(ingresosPorMetodo),
    totalEgresos: suma(egresosPorMetodo),
    efectivoEsperado: fondo + cobrosPorMetodo.efectivo + ingresosPorMetodo.efectivo - egresosPorMetodo.efectivo,
  };
}
