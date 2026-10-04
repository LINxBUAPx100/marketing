import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import type { Sesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { calcularTotales, importePartida, validarPartida } from "@/lib/ventas/calculo";
import { siguienteFolio } from "@/lib/almacen/existencias";
import type { PartidaEntrada } from "@/lib/ventas/servidor";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; mensaje: string };

export const CONDICIONES_INICIALES =
  "Precios sujetos a cambio sin previo aviso después de la vigencia.\nSe requiere 50 % de anticipo para iniciar el trabajo.\nEl tiempo de entrega corre a partir de la aprobación del diseño.";

export type CotizacionEntrada = {
  id: string | null;
  clienteId: string;
  vigenciaHasta: Date;
  notas: string | null;
  condiciones: string | null;
  partidas: PartidaEntrada[];
};

/** Crea o actualiza una cotización. Valida precios con las mismas reglas que una venta. */
export async function guardarCotizacion(sesion: Sesion, entrada: CotizacionEntrada): Promise<Resultado<{ id: string; folio: string }>> {
  const sucursal = sesion.sucursal;
  if (!sucursal) return { ok: false, mensaje: "No tienes una sucursal asignada." };
  if (!entrada.partidas.length) return { ok: false, mensaje: "Agrega al menos un producto o concepto." };
  const negocioId = sesion.negocio.id;

  const [cliente] = await db.select().from(t.cliente).where(and(eq(t.cliente.id, entrada.clienteId), eq(t.cliente.negocioId, negocioId)));
  if (!cliente) return { ok: false, mensaje: "Elige a qué cliente va la cotización." };

  let actual = null;
  if (entrada.id) {
    [actual] = await db.select().from(t.cotizacion).where(and(eq(t.cotizacion.id, entrada.id), eq(t.cotizacion.negocioId, negocioId)));
    if (!actual) return { ok: false, mensaje: "La cotización ya no existe." };
    if (actual.estado !== "abierta") return { ok: false, mensaje: "Solo se pueden editar cotizaciones abiertas." };
  }

  const ids = entrada.partidas.map((p) => p.productoId).filter((id): id is string => !!id);
  const productos = ids.length ? await db.select().from(t.producto).where(and(inArray(t.producto.id, ids), eq(t.producto.negocioId, negocioId))) : [];
  const porId = new Map(productos.map((p) => [p.id, p]));
  const puedeDescontar = sesion.puede("ventas.descuento");

  const partidas: (Omit<typeof t.cotizacionPartida.$inferInsert, "cotizacionId"> & { cantidad: number; precioUnitario: number; descuento: number })[] = [];
  for (const [i, p] of entrada.partidas.entries()) {
    const producto = p.productoId ? porId.get(p.productoId) : null;
    if (p.productoId && (!producto || !producto.activo)) return { ok: false, mensaje: "Un producto ya no está disponible. Quítalo e inténtalo de nuevo." };
    if (producto) {
      const lista = cliente.tipoPrecio === "revendedor" && producto.precioRevendedor != null ? producto.precioRevendedor : producto.precio;
      if ((p.precioUnitario !== lista || p.descuento > 0) && !puedeDescontar) {
        return { ok: false, mensaje: `No tienes permiso para cambiar el precio de "${producto.nombre}".` };
      }
    } else if (!p.descripcion.trim()) {
      return { ok: false, mensaje: "Escribe la descripción del concepto libre." };
    }
    const error = validarPartida(p);
    if (error) return { ok: false, mensaje: `${producto?.nombre ?? p.descripcion}: ${error}` };
    partidas.push({
      productoId: producto?.id ?? null,
      descripcion: producto?.nombre ?? p.descripcion.trim(),
      unidad: producto?.unidad ?? "servicio",
      cantidad: p.cantidad,
      precioUnitario: p.precioUnitario,
      descuento: p.descuento,
      importe: importePartida(p),
      notas: p.notas,
      orden: i,
    });
  }
  const totales = calcularTotales(partidas, sesion.negocio);
  const valores = {
    clienteId: cliente.id,
    subtotal: totales.subtotal,
    descuento: totales.descuento,
    iva: totales.iva,
    total: totales.total,
    vigenciaHasta: entrada.vigenciaHasta,
    notas: entrada.notas,
    condiciones: entrada.condiciones,
    actualizadoEn: new Date(),
  };

  const guardada = await db.transaction(async (tx) => {
    let c;
    if (actual) {
      [c] = await tx.update(t.cotizacion).set(valores).where(eq(t.cotizacion.id, actual.id)).returning();
      await tx.delete(t.cotizacionPartida).where(eq(t.cotizacionPartida.cotizacionId, actual.id));
    } else {
      const folio = await siguienteFolio(tx, sucursal.id, `${sucursal.prefijoFolio}-C`, "cotizacion");
      [c] = await tx
        .insert(t.cotizacion)
        .values({ ...valores, negocioId, sucursalId: sucursal.id, folio, usuarioId: sesion.usuario.id })
        .returning();
    }
    await tx.insert(t.cotizacionPartida).values(partidas.map((p) => ({ ...p, cotizacionId: c.id })));
    return c;
  });

  await registrar(sesion, actual ? "editar" : "crear", "cotizacion", guardada.id, { nombre: guardada.folio, total: guardada.total });
  return { ok: true, id: guardada.id, folio: guardada.folio };
}

export async function cerrarCotizacion(sesion: Sesion, id: string, estado: "rechazada" | "cancelada", motivo: string): Promise<Resultado> {
  const [c] = await db.select().from(t.cotizacion).where(and(eq(t.cotizacion.id, id), eq(t.cotizacion.negocioId, sesion.negocio.id)));
  if (!c) return { ok: false, mensaje: "La cotización ya no existe." };
  if (c.estado !== "abierta") return { ok: false, mensaje: "La cotización ya no está abierta." };
  await db.update(t.cotizacion).set({ estado, motivoRechazo: motivo, actualizadoEn: new Date() }).where(eq(t.cotizacion.id, id));
  await registrar(sesion, estado === "rechazada" ? "rechazar" : "cancelar", "cotizacion", id, { nombre: c.folio, motivo });
  return { ok: true };
}
