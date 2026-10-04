import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, t } from "@/db";
import { urlArchivo } from "@/lib/archivos";
import type { Sesion } from "@/lib/auth";

/** Venta completa para mostrar o imprimir. Null si no existe o el usuario no tiene acceso a su sucursal. */
export async function obtenerVenta(sesion: Sesion, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const canceladaPor = alias(t.usuario, "cancelada_por");

  const [fila] = await db
    .select({
      venta: t.venta,
      cliente: t.cliente,
      sucursal: t.sucursal,
      vendedor: t.usuario.nombre,
      canceladaPor: canceladaPor.nombre,
    })
    .from(t.venta)
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.venta.sucursalId))
    .innerJoin(t.usuario, eq(t.usuario.id, t.venta.usuarioId))
    .leftJoin(t.cliente, eq(t.cliente.id, t.venta.clienteId))
    .leftJoin(canceladaPor, eq(canceladaPor.id, t.venta.canceladaPor))
    .where(and(eq(t.venta.id, id), eq(t.venta.negocioId, sesion.negocio.id)));
  if (!fila) return null;
  if (!sesion.rol.esAdmin && !sesion.sucursales.some((s) => s.id === fila.venta.sucursalId)) return null;

  const [partidas, pagos, ordenes] = await Promise.all([
    db.select().from(t.ventaPartida).where(eq(t.ventaPartida.ventaId, id)).orderBy(asc(t.ventaPartida.orden)),
    db
      .select({
        id: t.pago.id,
        metodo: t.pago.metodo,
        monto: t.pago.monto,
        recibido: t.pago.recibido,
        referencia: t.pago.referencia,
        cancelado: t.pago.cancelado,
        creadoEn: t.pago.creadoEn,
        usuario: t.usuario.nombre,
        sucursal: t.sucursal.nombre,
      })
      .from(t.pago)
      .innerJoin(t.usuario, eq(t.usuario.id, t.pago.usuarioId))
      .innerJoin(t.sucursal, eq(t.sucursal.id, t.pago.sucursalId))
      .where(eq(t.pago.ventaId, id))
      .orderBy(asc(t.pago.creadoEn)),
    db
      .select({ id: t.ordenProduccion.id, estado: t.ordenProduccion.estado, etapa: t.etapaProduccion.nombre })
      .from(t.ordenProduccion)
      .innerJoin(t.etapaProduccion, eq(t.etapaProduccion.id, t.ordenProduccion.etapaId))
      .where(eq(t.ordenProduccion.ventaId, id)),
  ]);

  return { ...fila, partidas, pagos, orden: ordenes[0] ?? null, saldo: fila.venta.estado === "activa" ? fila.venta.total - fila.venta.pagado : 0 };
}

export type VentaCompleta = NonNullable<Awaited<ReturnType<typeof obtenerVenta>>>;

/** Productos activos con existencia en la sucursal actual, y categorías: lo que muestra el catálogo al vender o cotizar. */
export async function catalogoParaVender(sesion: Sesion) {
  const negocioId = sesion.negocio.id;
  const sucursalId = sesion.sucursal?.id ?? null;
  const [productos, categorias] = await Promise.all([
    db
      .select({
        id: t.producto.id,
        nombre: t.producto.nombre,
        codigo: t.producto.codigo,
        tipo: t.producto.tipo,
        unidad: t.producto.unidad,
        precio: t.producto.precio,
        precioRevendedor: t.producto.precioRevendedor,
        imagen: t.producto.imagen,
        categoriaId: t.producto.categoriaId,
        requiereProduccion: t.producto.requiereProduccion,
        existencia: sql<number | null>`${t.existencia.cantidad}::float`,
      })
      .from(t.producto)
      .leftJoin(t.existencia, and(eq(t.existencia.productoId, t.producto.id), sucursalId ? eq(t.existencia.sucursalId, sucursalId) : sql`false`))
      .where(and(eq(t.producto.negocioId, negocioId), eq(t.producto.activo, true)))
      .orderBy(asc(t.producto.nombre)),
    db
      .select({ id: t.categoria.id, nombre: t.categoria.nombre })
      .from(t.categoria)
      .where(and(eq(t.categoria.negocioId, negocioId), eq(t.categoria.activa, true)))
      .orderBy(asc(t.categoria.nombre)),
  ]);
  return { productos: productos.map((p) => ({ ...p, imagen: urlArchivo(p.imagen) })), categorias };
}

export async function clientePorId(sesion: Sesion, id: string | undefined | null) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [c] = await db
    .select({ id: t.cliente.id, nombre: t.cliente.nombre, empresa: t.cliente.empresa, telefono: t.cliente.telefono, tipoPrecio: t.cliente.tipoPrecio })
    .from(t.cliente)
    .where(and(eq(t.cliente.id, id), eq(t.cliente.negocioId, sesion.negocio.id)));
  return c ?? null;
}
