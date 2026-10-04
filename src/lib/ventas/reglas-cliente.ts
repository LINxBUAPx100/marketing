import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, t } from "@/db";
import type { EscalonVolumen, ReglasPrecio } from "./precios";

/** Convenio activo y vigente del cliente, con sus precios especiales. */
export async function convenioVigente(clienteId: string) {
  const [c] = await db
    .select()
    .from(t.convenio)
    .where(and(eq(t.convenio.clienteId, clienteId), eq(t.convenio.activo, true)));
  if (!c || (c.vigenteHasta && c.vigenteHasta < new Date())) return null;
  const precios = await db.select().from(t.convenioPrecio).where(eq(t.convenioPrecio.convenioId, c.id));
  return { ...c, precios: Object.fromEntries(precios.map((p) => [p.productoId, p.precio])) as Record<string, number> };
}

/** Reglas de precio y de crédito para vender o cotizar a un cliente (o al público en general). */
export async function reglasDeCliente(negocioId: string, clienteId: string | null) {
  if (!clienteId) {
    return { reglas: { tipoPrecio: "publico", convenio: null } as ReglasPrecio, limiteCredito: null, diasCredito: 0, saldo: 0, convenioId: null };
  }
  const [cliente] = await db.select().from(t.cliente).where(and(eq(t.cliente.id, clienteId), eq(t.cliente.negocioId, negocioId)));
  if (!cliente) return null;
  const [convenio, [deuda]] = await Promise.all([
    convenioVigente(clienteId),
    db
      .select({ saldo: sql<number>`coalesce(sum(${t.venta.total} - ${t.venta.pagado}), 0)::int` })
      .from(t.venta)
      .where(and(eq(t.venta.clienteId, clienteId), eq(t.venta.estado, "activa"))),
  ]);
  return {
    reglas: {
      tipoPrecio: cliente.tipoPrecio,
      convenio: convenio ? { descuentoBp: convenio.descuentoBp, precios: convenio.precios } : null,
    } as ReglasPrecio,
    limiteCredito: convenio?.limiteCredito ?? null,
    diasCredito: convenio?.diasCredito ?? 0,
    saldo: deuda.saldo,
    convenioId: convenio?.id ?? null,
  };
}

/** Escalones de precio por volumen de varios productos. */
export async function volumenDe(productoIds: string[]) {
  const mapa = new Map<string, EscalonVolumen[]>();
  if (!productoIds.length) return mapa;
  const filas = await db.select().from(t.precioVolumen).where(inArray(t.precioVolumen.productoId, productoIds)).orderBy(asc(t.precioVolumen.desde));
  for (const f of filas) {
    const lista = mapa.get(f.productoId) ?? [];
    lista.push({ desde: f.desde, precio: f.precio, precioRevendedor: f.precioRevendedor });
    mapa.set(f.productoId, lista);
  }
  return mapa;
}
