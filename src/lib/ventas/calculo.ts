// Cálculos de dinero de una venta. Funciones puras: todo en centavos y sin acceso a la base.

export type PartidaCalculo = {
  cantidad: number;
  /** Centavos por unidad. */
  precioUnitario: number;
  /** Centavos descontados a la partida completa. */
  descuento: number;
};

export type ConfigIva = { ivaBp: number; preciosIncluyenIva: boolean };

export type Totales = {
  /** Suma de cantidad × precio, antes de descuentos. */
  bruto: number;
  descuento: number;
  /** Base antes de IVA, ya con descuentos. */
  subtotal: number;
  iva: number;
  total: number;
};

export const brutoPartida = (p: PartidaCalculo) => Math.round(p.cantidad * p.precioUnitario);

export const importePartida = (p: PartidaCalculo) => brutoPartida(p) - p.descuento;

export function calcularTotales(partidas: PartidaCalculo[], { ivaBp, preciosIncluyenIva }: ConfigIva): Totales {
  const bruto = partidas.reduce((s, p) => s + brutoPartida(p), 0);
  const descuento = partidas.reduce((s, p) => s + p.descuento, 0);
  const neto = bruto - descuento;

  if (preciosIncluyenIva) {
    // El precio ya trae IVA: se desglosa hacia atrás.
    const subtotal = Math.round((neto * 10000) / (10000 + ivaBp));
    return { bruto, descuento, subtotal, iva: neto - subtotal, total: neto };
  }
  const iva = Math.round((neto * ivaBp) / 10000);
  return { bruto, descuento, subtotal: neto, iva, total: neto + iva };
}

export type PagoCalculo = { metodo: string; monto: number; recibido?: number | null };

/** Errores de una partida, en texto para mostrar. */
export function validarPartida(p: PartidaCalculo): string | null {
  if (!(p.cantidad > 0)) return "La cantidad debe ser mayor que cero.";
  if (p.precioUnitario < 0) return "El precio no puede ser negativo.";
  if (p.descuento < 0) return "El descuento no puede ser negativo.";
  if (p.descuento > brutoPartida(p)) return "El descuento no puede ser mayor que el importe.";
  return null;
}

/** Revisa los pagos contra el total. Devuelve un mensaje si algo no cuadra. */
export function validarPagos(pagos: PagoCalculo[], porCobrar: number): string | null {
  for (const p of pagos) {
    if (!(p.monto > 0)) return "Cada pago debe ser mayor que cero.";
    if (p.recibido != null && p.recibido < p.monto) return "El efectivo recibido es menor que el pago.";
  }
  const suma = pagos.reduce((s, p) => s + p.monto, 0);
  if (suma > porCobrar) return "Los pagos suman más de lo que se debe.";
  return null;
}

export const cambioDe = (pagos: PagoCalculo[]) =>
  pagos.reduce((s, p) => s + (p.recibido != null ? p.recibido - p.monto : 0), 0);
