// Reglas de inventario, costos y cuentas por pagar. Funciones puras.

import type { ConfigIva } from "@/lib/ventas/calculo";

/** Redondea cantidades a 3 decimales (la precisión con que se guardan). */
export const redondear3 = (n: number) => Math.round(n * 1000) / 1000;

export type RenglonReceta = { insumoId: string; cantidad: number; costoInsumo: number };

/** Costo de UNA unidad del producto según su receta, en centavos (con decimales). */
export const costoReceta = (receta: RenglonReceta[]) => receta.reduce((s, r) => s + r.cantidad * r.costoInsumo, 0);

/**
 * Costo total de una partida vendida, en centavos enteros.
 * Si el producto tiene receta manda la receta; si no, su costo capturado; si no hay ninguno, null.
 */
export function costoPartida(cantidad: number, receta: RenglonReceta[], costoProducto: number | null) {
  if (receta.length) return Math.round(cantidad * costoReceta(receta));
  if (costoProducto != null) return Math.round(cantidad * costoProducto);
  return null;
}

/** Cuánto de cada insumo se consume en una venta: suma de cantidad vendida × receta. */
export function consumoDeInsumos(partidas: { productoId: string | null; cantidad: number }[], recetas: Map<string, RenglonReceta[]>) {
  const consumo = new Map<string, number>();
  for (const p of partidas) {
    if (!p.productoId) continue;
    for (const r of recetas.get(p.productoId) ?? []) {
      consumo.set(r.insumoId, redondear3((consumo.get(r.insumoId) ?? 0) + p.cantidad * r.cantidad));
    }
  }
  return consumo;
}

/** Lo que realmente le queda al negocio de un importe: sin IVA. */
export function ingresoSinIva(importe: number, { ivaBp, preciosIncluyenIva }: ConfigIva) {
  return preciosIncluyenIva ? Math.round((importe * 10000) / (10000 + ivaBp)) : importe;
}

/** Utilidad y margen de una partida o venta. Margen null si no hay costo. */
export function utilidad(ingreso: number, costo: number | null) {
  if (costo == null) return { utilidad: null, margen: null };
  const u = ingreso - costo;
  return { utilidad: u, margen: ingreso > 0 ? u / ingreso : null };
}

export type EstadoCxP = "pagada" | "cancelada" | "vencida" | "por-vencer" | "al-corriente";

/** Estado de una compra a crédito. "Por vencer" = vence en los próximos 7 días. */
export function estadoCuentaPorPagar(c: { total: number; pagado: number; vencimiento: Date; estado: "activa" | "cancelada" }, ahora = new Date()): EstadoCxP {
  if (c.estado === "cancelada") return "cancelada";
  if (c.pagado >= c.total) return "pagada";
  const dias = (c.vencimiento.getTime() - ahora.getTime()) / 86_400_000;
  if (dias < 0) return "vencida";
  if (dias <= 7) return "por-vencer";
  return "al-corriente";
}

export const ETIQUETA_CXP: Record<EstadoCxP, string> = {
  pagada: "Pagada",
  cancelada: "Cancelada",
  vencida: "Vencida",
  "por-vencer": "Vence pronto",
  "al-corriente": "Al corriente",
};

/** Texto de cada motivo de movimiento de inventario (productos e insumos). */
export const ETIQUETA_MOTIVO: Record<string, string> = {
  inicial: "Existencia inicial",
  ajuste: "Ajuste por conteo",
  venta: "Venta",
  consumo: "Consumo en venta",
  cancelacion: "Venta cancelada",
  compra: "Compra",
  compra_cancelada: "Compra cancelada",
  traspaso: "Traspaso",
};
