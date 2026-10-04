// Qué precio le toca a un cliente por un producto. La misma regla corre en el navegador
// (punto de venta y cotizaciones) y en el servidor (que es quien decide). Función pura.

export type EscalonVolumen = { desde: number; precio: number; precioRevendedor: number | null };

export type ProductoPrecio = {
  id: string;
  precio: number;
  precioRevendedor: number | null;
  volumen: EscalonVolumen[];
};

export type ConvenioPrecio = { descuentoBp: number; precios: Record<string, number> };

export type ReglasPrecio = { tipoPrecio: "publico" | "revendedor"; convenio: ConvenioPrecio | null };

export type PrecioCalculado = {
  /** Centavos por unidad. */
  precio: number;
  origen: "convenio" | "volumen" | "lista";
  /** Escalón aplicado, para explicarlo en pantalla. */
  desde: number | null;
  conDescuentoConvenio: boolean;
};

/**
 * 1. Precio especial del convenio para ese producto, si existe (ya negociado: no lleva más descuento).
 * 2. Si no: escalón de volumen más alto alcanzado por la cantidad (revendedor usa su columna si la tiene).
 * 3. Si no: precio de lista (revendedor si aplica).
 * En 2 y 3 se aplica el descuento general del convenio.
 */
export function precioPara(p: ProductoPrecio, cantidad: number, reglas: ReglasPrecio): PrecioCalculado {
  const especial = reglas.convenio?.precios[p.id];
  if (especial != null) return { precio: especial, origen: "convenio", desde: null, conDescuentoConvenio: false };

  const revendedor = reglas.tipoPrecio === "revendedor";
  const escalon = [...p.volumen].sort((a, b) => b.desde - a.desde).find((e) => cantidad >= e.desde);
  let base: number;
  let origen: PrecioCalculado["origen"] = "lista";
  if (escalon) {
    base = revendedor && escalon.precioRevendedor != null ? escalon.precioRevendedor : escalon.precio;
    // Un escalón nunca debe salir más caro que el precio de lista del cliente.
    const lista = revendedor && p.precioRevendedor != null ? p.precioRevendedor : p.precio;
    if (base > lista) base = lista;
    else origen = "volumen";
  } else {
    base = revendedor && p.precioRevendedor != null ? p.precioRevendedor : p.precio;
  }

  const descuento = reglas.convenio?.descuentoBp ?? 0;
  const precio = descuento ? Math.round((base * (10000 - descuento)) / 10000) : base;
  return { precio, origen, desde: origen === "volumen" ? escalon!.desde : null, conDescuentoConvenio: descuento > 0 };
}

/** Comisión de una partida: base sin IVA × puntos base, redondeada al centavo. */
export const comisionDe = (base: number, bp: number) => Math.round((base * bp) / 10000);

/** ¿Dejar este saldo rebasa el límite de crédito del cliente? Sin límite, nunca. */
export function rebasaLimite(saldoActual: number, saldoNuevo: number, limite: number | null) {
  if (limite == null || saldoNuevo <= 0) return false;
  return saldoActual + saldoNuevo > limite;
}
