import "server-only";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { rangoDeDias } from "@/lib/fechas";
import { periodoAnterior, serieDiaria } from "./reglas";

export type FiltroReporte = { negocioId: string; sucursalIds: string[]; desde: string; hasta: string };

const diaMexico = (col: unknown) => sql<string>`to_char(${col} at time zone 'America/Mexico_City', 'YYYY-MM-DD')`;
const suma = (col: unknown) => sql<number>`coalesce(sum(${col}), 0)::bigint::float8`;
const cuenta = sql<number>`count(*)::int`;

function filtroVentas(f: FiltroReporte, desde = f.desde, hasta = f.hasta) {
  const { inicio, fin } = rangoDeDias(desde, hasta);
  return and(
    eq(t.venta.negocioId, f.negocioId),
    inArray(t.venta.sucursalId, f.sucursalIds),
    eq(t.venta.estado, "activa"),
    gte(t.venta.creadoEn, inicio),
    lt(t.venta.creadoEn, fin),
  );
}

async function totalesVentas(f: FiltroReporte, desde: string, hasta: string) {
  const [r] = await db
    .select({ ventas: cuenta, total: suma(t.venta.total), iva: suma(t.venta.iva), descuento: suma(t.venta.descuento), saldo: suma(sql`${t.venta.total} - ${t.venta.pagado}`) })
    .from(t.venta)
    .where(filtroVentas(f, desde, hasta));
  return r;
}

/** Todo el reporte de ventas de un periodo. Dinero en centavos. */
export async function reporteVentas(f: FiltroReporte) {
  if (!f.sucursalIds.length) return null;
  const { inicio, fin } = rangoDeDias(f.desde, f.hasta);
  const ant = periodoAnterior(f.desde, f.hasta);
  const ventas = filtroVentas(f);

  const [actual, anterior, costos, cobrado, canceladas, gastos, porDia, porSucursal, porVendedor, porMetodo, productos, categorias, clientes] = await Promise.all([
    totalesVentas(f, f.desde, f.hasta),
    totalesVentas(f, ant.desde, ant.hasta),
    // Utilidad: solo partidas con costo conocido, sobre su importe sin IVA.
    db
      .select({
        importe: suma(sql`case when ${t.ventaPartida.costo} is not null then ${t.ventaPartida.importe} end`),
        costo: suma(t.ventaPartida.costo),
        sinCosto: sql<number>`count(*) filter (where ${t.ventaPartida.costo} is null)::int`,
      })
      .from(t.ventaPartida)
      .innerJoin(t.venta, eq(t.venta.id, t.ventaPartida.ventaId))
      .where(ventas),
    db
      .select({ total: suma(t.pago.monto) })
      .from(t.pago)
      .where(and(eq(t.pago.negocioId, f.negocioId), inArray(t.pago.sucursalId, f.sucursalIds), eq(t.pago.cancelado, false), gte(t.pago.creadoEn, inicio), lt(t.pago.creadoEn, fin))),
    db
      .select({ ventas: cuenta, total: suma(t.venta.total) })
      .from(t.venta)
      .where(and(eq(t.venta.negocioId, f.negocioId), inArray(t.venta.sucursalId, f.sucursalIds), eq(t.venta.estado, "cancelada"), gte(t.venta.creadoEn, inicio), lt(t.venta.creadoEn, fin))),
    db
      .select({ categoria: t.movimientoCaja.categoria, total: suma(t.movimientoCaja.monto) })
      .from(t.movimientoCaja)
      .where(
        and(
          eq(t.movimientoCaja.negocioId, f.negocioId),
          inArray(t.movimientoCaja.sucursalId, f.sucursalIds),
          eq(t.movimientoCaja.tipo, "egreso"),
          gte(t.movimientoCaja.creadoEn, inicio),
          lt(t.movimientoCaja.creadoEn, fin),
        ),
      )
      .groupBy(t.movimientoCaja.categoria)
      .orderBy(desc(suma(t.movimientoCaja.monto))),
    db
      .select({ dia: diaMexico(t.venta.creadoEn), ventas: cuenta, total: suma(t.venta.total) })
      .from(t.venta)
      .where(ventas)
      .groupBy(diaMexico(t.venta.creadoEn)),
    db
      .select({ nombre: t.sucursal.nombre, ventas: cuenta, total: suma(t.venta.total) })
      .from(t.venta)
      .innerJoin(t.sucursal, eq(t.sucursal.id, t.venta.sucursalId))
      .where(ventas)
      .groupBy(t.sucursal.nombre)
      .orderBy(desc(suma(t.venta.total))),
    db
      .select({ nombre: t.usuario.nombre, ventas: cuenta, total: suma(t.venta.total) })
      .from(t.venta)
      .innerJoin(t.usuario, eq(t.usuario.id, t.venta.usuarioId))
      .where(ventas)
      .groupBy(t.usuario.nombre)
      .orderBy(desc(suma(t.venta.total))),
    db
      .select({ metodo: t.pago.metodo, pagos: cuenta, total: suma(t.pago.monto) })
      .from(t.pago)
      .where(and(eq(t.pago.negocioId, f.negocioId), inArray(t.pago.sucursalId, f.sucursalIds), eq(t.pago.cancelado, false), gte(t.pago.creadoEn, inicio), lt(t.pago.creadoEn, fin)))
      .groupBy(t.pago.metodo)
      .orderBy(desc(suma(t.pago.monto))),
    db
      .select({
        nombre: t.ventaPartida.descripcion,
        unidad: t.ventaPartida.unidad,
        cantidad: sql<number>`sum(${t.ventaPartida.cantidad})::float8`,
        importe: suma(t.ventaPartida.importe),
        veces: cuenta,
      })
      .from(t.ventaPartida)
      .innerJoin(t.venta, eq(t.venta.id, t.ventaPartida.ventaId))
      .where(ventas)
      .groupBy(t.ventaPartida.descripcion, t.ventaPartida.unidad)
      .orderBy(desc(suma(t.ventaPartida.importe)))
      .limit(20),
    db
      .select({ nombre: sql<string>`coalesce(${t.categoria.nombre}, 'Sin categoría')`, importe: suma(t.ventaPartida.importe) })
      .from(t.ventaPartida)
      .innerJoin(t.venta, eq(t.venta.id, t.ventaPartida.ventaId))
      .leftJoin(t.producto, eq(t.producto.id, t.ventaPartida.productoId))
      .leftJoin(t.categoria, eq(t.categoria.id, t.producto.categoriaId))
      .where(ventas)
      .groupBy(t.categoria.nombre)
      .orderBy(desc(suma(t.ventaPartida.importe))),
    db
      .select({ id: t.cliente.id, nombre: sql<string>`coalesce(${t.cliente.nombre}, 'Público en general')`, ventas: cuenta, total: suma(t.venta.total) })
      .from(t.venta)
      .leftJoin(t.cliente, eq(t.cliente.id, t.venta.clienteId))
      .where(ventas)
      .groupBy(t.cliente.id, t.cliente.nombre)
      .orderBy(desc(suma(t.venta.total)))
      .limit(15),
  ]);

  return {
    actual,
    anterior,
    utilidad: costos[0],
    cobrado: cobrado[0].total,
    canceladas: canceladas[0],
    gastos,
    porDia: serieDiaria(f.desde, f.hasta, porDia, { ventas: 0, total: 0 }),
    porSucursal,
    porVendedor,
    porMetodo,
    productos,
    categorias,
    clientes,
  };
}

export type ReporteVentas = NonNullable<Awaited<ReturnType<typeof reporteVentas>>>;
