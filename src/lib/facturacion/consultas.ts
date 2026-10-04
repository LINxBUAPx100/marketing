import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import type { Sesion } from "@/lib/auth";
import type { DatosFacturar } from "@/components/facturacion/dialogo-facturar";
import { ambientePac } from "./pac";
import { erroresReceptor, formaYMetodo } from "./reglas";

/** Lo que necesita el diálogo de facturar para un grupo de ventas del mismo cliente. */
export async function datosParaFacturar(sesion: Sesion, ventaIds: string[]): Promise<DatosFacturar | null> {
  if (!ventaIds.length) return null;
  const ventas = await db
    .select()
    .from(t.venta)
    .where(and(inArray(t.venta.id, ventaIds), eq(t.venta.negocioId, sesion.negocio.id)));
  const clienteId = ventas[0]?.clienteId;
  if (!clienteId || ventas.some((v) => v.clienteId !== clienteId)) return null;
  const [[cliente], pagos] = await Promise.all([
    db.select().from(t.cliente).where(eq(t.cliente.id, clienteId)),
    db
      .select({ metodo: t.pago.metodo, monto: t.pago.monto })
      .from(t.pago)
      .where(and(inArray(t.pago.ventaId, ventaIds), eq(t.pago.cancelado, false))),
  ]);
  const total = ventas.reduce((s, v) => s + v.total, 0);
  return {
    ventaIds,
    total,
    ...formaYMetodo(total, pagos),
    cliente: { id: cliente.id, nombre: cliente.nombre, rfc: cliente.rfc, razonSocial: cliente.razonSocial, usoCfdi: cliente.usoCfdi, correo: cliente.correo },
    errores: erroresReceptor(cliente),
    simulado: ambientePac().nombre === "Simulador",
  };
}

/** Factura de ingreso vigente de una venta, si la tiene. */
export async function facturaDeVenta(ventaId: string) {
  const [f] = await db
    .select({ id: t.factura.id, serie: t.factura.serie, folio: t.factura.folio, metodoPago: t.factura.metodoPago, global: t.factura.global })
    .from(t.facturaVenta)
    .innerJoin(t.factura, eq(t.factura.id, t.facturaVenta.facturaId))
    .where(and(eq(t.facturaVenta.ventaId, ventaId), eq(t.factura.estado, "vigente"), eq(t.factura.tipo, "I")));
  return f ?? null;
}
