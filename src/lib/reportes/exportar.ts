import "server-only";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import type { Sesion } from "@/lib/auth";
import { ETIQUETA_METODO, type Metodo } from "@/lib/caja/resumen";
import { hoja, type Hoja } from "@/lib/excel";
import { esFecha, hoyEnMexico, rangoDeDias } from "@/lib/fechas";
import { ETIQUETA_FORMA_PAGO } from "@/lib/facturacion/reglas";
import { reporteVentas } from "./consultas";

// Catálogos que se pueden bajar a Excel. Cada uno pide el permiso de ver su módulo.

type Parametros = { desde: string; hasta: string; sucursalIds: string[] };

type Catalogo = {
  titulo: string;
  permiso: string;
  /** Usa el periodo desde/hasta. */
  conPeriodo?: boolean;
  hojas: (sesion: Sesion, p: Parametros) => Promise<Hoja[]>;
};

const siNo = (v: boolean) => (v ? "Sí" : "No");

export const CATALOGOS: Record<string, Catalogo> = {
  clientes: {
    titulo: "Clientes",
    permiso: "clientes.ver",
    hojas: async (sesion) => {
      const filas = await db
        .select({
          c: t.cliente,
          saldo: sql<number>`coalesce((select sum(v.total - v.pagado) from ${t.venta} v where v.cliente_id = ${t.cliente.id} and v.estado = 'activa'), 0)::int`,
        })
        .from(t.cliente)
        .where(eq(t.cliente.negocioId, sesion.negocio.id))
        .orderBy(asc(t.cliente.nombre));
      return [
        hoja({
          nombre: "Clientes",
          filas,
          columnas: [
            { titulo: "Nombre", valor: (f) => f.c.nombre, ancho: 32 },
            { titulo: "Empresa", valor: (f) => f.c.empresa },
            { titulo: "Teléfono", valor: (f) => f.c.telefono, ancho: 16 },
            { titulo: "Correo", valor: (f) => f.c.correo, ancho: 28 },
            { titulo: "Precio", valor: (f) => (f.c.tipoPrecio === "revendedor" ? "Revendedor" : "Público"), ancho: 12 },
            { titulo: "RFC", valor: (f) => f.c.rfc, ancho: 16 },
            { titulo: "Razón social", valor: (f) => f.c.razonSocial, ancho: 32 },
            { titulo: "Régimen", valor: (f) => f.c.regimenFiscal, ancho: 10 },
            { titulo: "C.P.", valor: (f) => f.c.codigoPostal, ancho: 8 },
            { titulo: "Uso CFDI", valor: (f) => f.c.usoCfdi, ancho: 10 },
            { titulo: "Saldo", valor: (f) => f.saldo, tipo: "dinero" },
            { titulo: "Activo", valor: (f) => siNo(f.c.activo), ancho: 8 },
            { titulo: "Notas", valor: (f) => f.c.notas, ancho: 40 },
            { titulo: "Alta", valor: (f) => f.c.creadoEn, tipo: "fecha" },
          ],
        }),
      ];
    },
  },

  productos: {
    titulo: "Productos",
    permiso: "productos.ver",
    hojas: async (sesion, p) => {
      const verCostos = sesion.puede("productos.costos");
      const filas = await db
        .select({
          p: t.producto,
          categoria: t.categoria.nombre,
          existencia: sql<number>`coalesce((select sum(e.cantidad) from ${t.existencia} e where e.producto_id = ${t.producto.id} and e.sucursal_id in ${p.sucursalIds.length ? p.sucursalIds : [null]}), 0)::float8`,
        })
        .from(t.producto)
        .leftJoin(t.categoria, eq(t.categoria.id, t.producto.categoriaId))
        .where(eq(t.producto.negocioId, sesion.negocio.id))
        .orderBy(asc(t.producto.nombre));
      return [
        hoja({
          nombre: "Productos",
          filas,
          columnas: [
            { titulo: "Código", valor: (f) => f.p.codigo, ancho: 12 },
            { titulo: "Nombre", valor: (f) => f.p.nombre, ancho: 34 },
            { titulo: "Categoría", valor: (f) => f.categoria, ancho: 18 },
            { titulo: "Tipo", valor: (f) => f.p.tipo, ancho: 10 },
            { titulo: "Unidad", valor: (f) => f.p.unidad, ancho: 10 },
            { titulo: "Precio", valor: (f) => f.p.precio, tipo: "dinero" },
            { titulo: "Precio revendedor", valor: (f) => f.p.precioRevendedor, tipo: "dinero" },
            ...(verCostos ? [{ titulo: "Costo", valor: (f: (typeof filas)[number]) => f.p.costo, tipo: "dinero" as const }] : []),
            { titulo: "Existencia", valor: (f) => (f.p.tipo === "servicio" ? null : f.existencia), tipo: "numero" },
            { titulo: "Mínimo", valor: (f) => f.p.existenciaMinima, tipo: "numero" },
            { titulo: "Clave SAT", valor: (f) => f.p.claveSat, ancho: 12 },
            { titulo: "Clave unidad", valor: (f) => f.p.claveUnidad, ancho: 12 },
            { titulo: "Producción", valor: (f) => siNo(f.p.requiereProduccion), ancho: 11 },
            { titulo: "Activo", valor: (f) => siNo(f.p.activo), ancho: 8 },
          ],
        }),
      ];
    },
  },

  insumos: {
    titulo: "Insumos",
    permiso: "insumos.ver",
    hojas: async (sesion, p) => {
      const filas = await db
        .select({
          i: t.insumo,
          proveedor: t.proveedor.nombre,
          existencia: sql<number>`coalesce((select sum(e.cantidad) from ${t.existenciaInsumo} e where e.insumo_id = ${t.insumo.id} and e.sucursal_id in ${p.sucursalIds.length ? p.sucursalIds : [null]}), 0)::float8`,
        })
        .from(t.insumo)
        .leftJoin(t.proveedor, eq(t.proveedor.id, t.insumo.proveedorId))
        .where(eq(t.insumo.negocioId, sesion.negocio.id))
        .orderBy(asc(t.insumo.nombre));
      return [
        hoja({
          nombre: "Insumos",
          filas,
          columnas: [
            { titulo: "Código", valor: (f) => f.i.codigo, ancho: 12 },
            { titulo: "Nombre", valor: (f) => f.i.nombre, ancho: 34 },
            { titulo: "Unidad", valor: (f) => f.i.unidad, ancho: 10 },
            { titulo: "Costo unitario", valor: (f) => f.i.costo, tipo: "dinero" },
            { titulo: "Existencia", valor: (f) => f.existencia, tipo: "numero" },
            { titulo: "Mínimo", valor: (f) => f.i.existenciaMinima, tipo: "numero" },
            { titulo: "Proveedor", valor: (f) => f.proveedor, ancho: 26 },
            { titulo: "Activo", valor: (f) => siNo(f.i.activo), ancho: 8 },
          ],
        }),
      ];
    },
  },

  proveedores: {
    titulo: "Proveedores",
    permiso: "cxp.ver",
    hojas: async (sesion) => {
      const filas = await db
        .select({
          p: t.proveedor,
          saldo: sql<number>`coalesce((select sum(c.total - c.pagado) from ${t.compra} c where c.proveedor_id = ${t.proveedor.id} and c.estado = 'activa'), 0)::int`,
        })
        .from(t.proveedor)
        .where(eq(t.proveedor.negocioId, sesion.negocio.id))
        .orderBy(asc(t.proveedor.nombre));
      return [
        hoja({
          nombre: "Proveedores",
          filas,
          columnas: [
            { titulo: "Nombre", valor: (f) => f.p.nombre, ancho: 30 },
            { titulo: "Contacto", valor: (f) => f.p.contacto },
            { titulo: "Teléfono", valor: (f) => f.p.telefono, ancho: 16 },
            { titulo: "Correo", valor: (f) => f.p.correo, ancho: 28 },
            { titulo: "RFC", valor: (f) => f.p.rfc, ancho: 16 },
            { titulo: "Días de crédito", valor: (f) => f.p.diasCredito, tipo: "numero" },
            { titulo: "Saldo por pagar", valor: (f) => f.saldo, tipo: "dinero" },
            { titulo: "Activo", valor: (f) => siNo(f.p.activo), ancho: 8 },
            { titulo: "Notas", valor: (f) => f.p.notas, ancho: 40 },
          ],
        }),
      ];
    },
  },

  usuarios: {
    titulo: "Usuarios",
    permiso: "usuarios.ver",
    hojas: async (sesion) => {
      const filas = await db
        .select({ u: t.usuario, rol: t.rol.nombre })
        .from(t.usuario)
        .innerJoin(t.rol, eq(t.rol.id, t.usuario.rolId))
        .where(eq(t.usuario.negocioId, sesion.negocio.id))
        .orderBy(asc(t.usuario.nombre));
      return [
        hoja({
          nombre: "Usuarios",
          filas,
          columnas: [
            { titulo: "Nombre", valor: (f) => f.u.nombre, ancho: 28 },
            { titulo: "Correo", valor: (f) => f.u.correo, ancho: 28 },
            { titulo: "Teléfono", valor: (f) => f.u.telefono, ancho: 16 },
            { titulo: "Rol", valor: (f) => f.rol, ancho: 18 },
            { titulo: "Comisión", valor: (f) => f.u.comisionBp, tipo: "porcentaje" },
            { titulo: "Activo", valor: (f) => siNo(f.u.activo), ancho: 8 },
            { titulo: "Último acceso", valor: (f) => f.u.ultimoAcceso, tipo: "fecha" },
          ],
        }),
      ];
    },
  },

  ventas: {
    titulo: "Ventas",
    permiso: "ventas.ver",
    conPeriodo: true,
    hojas: async (sesion, p) => {
      const { inicio, fin } = rangoDeDias(p.desde, p.hasta);
      const donde = and(eq(t.venta.negocioId, sesion.negocio.id), inArray(t.venta.sucursalId, p.sucursalIds), gte(t.venta.creadoEn, inicio), lt(t.venta.creadoEn, fin));
      const [ventas, partidas, pagos] = await Promise.all([
        db
          .select({ v: t.venta, sucursal: t.sucursal.nombre, cliente: t.cliente.nombre, vendedor: t.usuario.nombre })
          .from(t.venta)
          .innerJoin(t.sucursal, eq(t.sucursal.id, t.venta.sucursalId))
          .innerJoin(t.usuario, eq(t.usuario.id, t.venta.usuarioId))
          .leftJoin(t.cliente, eq(t.cliente.id, t.venta.clienteId))
          .where(donde)
          .orderBy(asc(t.venta.creadoEn)),
        db
          .select({ p: t.ventaPartida, folio: t.venta.folio, estado: t.venta.estado })
          .from(t.ventaPartida)
          .innerJoin(t.venta, eq(t.venta.id, t.ventaPartida.ventaId))
          .where(donde)
          .orderBy(asc(t.venta.creadoEn)),
        db
          .select({ p: t.pago, folio: t.venta.folio })
          .from(t.pago)
          .innerJoin(t.venta, eq(t.venta.id, t.pago.ventaId))
          .where(and(eq(t.pago.negocioId, sesion.negocio.id), inArray(t.pago.sucursalId, p.sucursalIds), gte(t.pago.creadoEn, inicio), lt(t.pago.creadoEn, fin)))
          .orderBy(asc(t.pago.creadoEn)),
      ]);
      return [
        hoja({
          nombre: "Ventas",
          filas: ventas,
          columnas: [
            { titulo: "Folio", valor: (f) => f.v.folio, ancho: 12 },
            { titulo: "Fecha", valor: (f) => f.v.creadoEn, tipo: "fecha" },
            { titulo: "Sucursal", valor: (f) => f.sucursal, ancho: 16 },
            { titulo: "Cliente", valor: (f) => f.cliente ?? "Público en general", ancho: 28 },
            { titulo: "Vendedor", valor: (f) => f.vendedor, ancho: 20 },
            { titulo: "Subtotal", valor: (f) => f.v.subtotal, tipo: "dinero" },
            { titulo: "Descuento", valor: (f) => f.v.descuento, tipo: "dinero" },
            { titulo: "IVA", valor: (f) => f.v.iva, tipo: "dinero" },
            { titulo: "Total", valor: (f) => f.v.total, tipo: "dinero" },
            { titulo: "Pagado", valor: (f) => f.v.pagado, tipo: "dinero" },
            { titulo: "Saldo", valor: (f) => (f.v.estado === "activa" ? f.v.total - f.v.pagado : 0), tipo: "dinero" },
            { titulo: "Estado", valor: (f) => (f.v.estado === "activa" ? "Activa" : "Cancelada"), ancho: 10 },
            { titulo: "Entrega", valor: (f) => f.v.fechaEntrega, tipo: "fecha" },
            { titulo: "Notas", valor: (f) => f.v.notas, ancho: 40 },
          ],
        }),
        hoja({
          nombre: "Partidas",
          filas: partidas,
          columnas: [
            { titulo: "Folio", valor: (f) => f.folio, ancho: 12 },
            { titulo: "Descripción", valor: (f) => f.p.descripcion, ancho: 34 },
            { titulo: "Cantidad", valor: (f) => f.p.cantidad, tipo: "numero" },
            { titulo: "Unidad", valor: (f) => f.p.unidad, ancho: 10 },
            { titulo: "Precio unitario", valor: (f) => f.p.precioUnitario, tipo: "dinero" },
            { titulo: "Descuento", valor: (f) => f.p.descuento, tipo: "dinero" },
            { titulo: "Importe", valor: (f) => f.p.importe, tipo: "dinero" },
            ...(sesion.puede("productos.costos") ? [{ titulo: "Costo", valor: (f: (typeof partidas)[number]) => f.p.costo, tipo: "dinero" as const }] : []),
            { titulo: "Venta cancelada", valor: (f) => (f.estado === "cancelada" ? "Sí" : ""), ancho: 10 },
          ],
        }),
        hoja({
          nombre: "Pagos",
          filas: pagos,
          columnas: [
            { titulo: "Folio", valor: (f) => f.folio, ancho: 12 },
            { titulo: "Fecha", valor: (f) => f.p.creadoEn, tipo: "fecha" },
            { titulo: "Forma de pago", valor: (f) => ETIQUETA_METODO[f.p.metodo as Metodo] ?? f.p.metodo, ancho: 14 },
            { titulo: "Monto", valor: (f) => f.p.monto, tipo: "dinero" },
            { titulo: "Referencia", valor: (f) => f.p.referencia, ancho: 20 },
            { titulo: "Cancelado", valor: (f) => (f.p.cancelado ? "Sí" : ""), ancho: 10 },
          ],
        }),
      ];
    },
  },

  facturas: {
    titulo: "Facturas",
    permiso: "facturacion.ver",
    conPeriodo: true,
    hojas: async (sesion, p) => {
      const { inicio, fin } = rangoDeDias(p.desde, p.hasta);
      const filas = await db
        .select()
        .from(t.factura)
        .where(and(eq(t.factura.negocioId, sesion.negocio.id), inArray(t.factura.sucursalId, p.sucursalIds), gte(t.factura.creadoEn, inicio), lt(t.factura.creadoEn, fin)))
        .orderBy(asc(t.factura.creadoEn));
      return [
        hoja({
          nombre: "Facturas",
          filas,
          columnas: [
            { titulo: "Serie y folio", valor: (f) => `${f.serie}-${f.folio}`, ancho: 12 },
            { titulo: "Tipo", valor: (f) => (f.tipo === "I" ? "Ingreso" : "Pago"), ancho: 9 },
            { titulo: "Fecha", valor: (f) => f.creadoEn, tipo: "fecha" },
            { titulo: "RFC receptor", valor: (f) => (f.receptor as { rfc: string }).rfc, ancho: 16 },
            { titulo: "Receptor", valor: (f) => (f.receptor as { nombre: string }).nombre, ancho: 32 },
            { titulo: "Subtotal", valor: (f) => f.subtotal, tipo: "dinero" },
            { titulo: "IVA", valor: (f) => f.iva, tipo: "dinero" },
            { titulo: "Total", valor: (f) => f.total, tipo: "dinero" },
            { titulo: "Método", valor: (f) => f.metodoPago, ancho: 8 },
            { titulo: "Forma de pago", valor: (f) => (f.formaPago ? `${f.formaPago} ${ETIQUETA_FORMA_PAGO[f.formaPago] ?? ""}`.trim() : null), ancho: 18 },
            { titulo: "Uso CFDI", valor: (f) => f.usoCfdi, ancho: 9 },
            { titulo: "Estado", valor: (f) => (f.estado === "vigente" ? "Vigente" : "Cancelada"), ancho: 10 },
            { titulo: "Folio fiscal (UUID)", valor: (f) => f.uuid, ancho: 38 },
            { titulo: "Simulada", valor: (f) => (f.simulada ? "Sí, sin validez fiscal" : ""), ancho: 12 },
          ],
        }),
      ];
    },
  },

  reporte: {
    titulo: "Reporte de ventas",
    permiso: "reportes.ver",
    conPeriodo: true,
    hojas: async (sesion, p) => {
      const r = await reporteVentas({ negocioId: sesion.negocio.id, sucursalIds: p.sucursalIds, desde: p.desde, hasta: p.hasta });
      if (!r) return [];
      const ranking = (nombre: string, filas: { nombre: string; total: number; ventas?: number }[], etiqueta = "Ventas") =>
        hoja({
          nombre,
          filas,
          columnas: [
            { titulo: nombre, valor: (f) => f.nombre, ancho: 34 },
            ...(filas.some((f) => f.ventas != null) ? [{ titulo: etiqueta, valor: (f: (typeof filas)[number]) => f.ventas, tipo: "numero" as const }] : []),
            { titulo: "Total", valor: (f) => f.total, tipo: "dinero" },
          ],
        });
      return [
        hoja({
          nombre: "Por día",
          filas: r.porDia,
          columnas: [
            { titulo: "Día", valor: (f) => f.dia, ancho: 12 },
            { titulo: "Ventas", valor: (f) => f.ventas, tipo: "numero" },
            { titulo: "Total", valor: (f) => f.total, tipo: "dinero" },
          ],
        }),
        hoja({
          nombre: "Productos",
          filas: r.productos,
          columnas: [
            { titulo: "Producto", valor: (f) => f.nombre, ancho: 34 },
            { titulo: "Cantidad", valor: (f) => f.cantidad, tipo: "numero" },
            { titulo: "Unidad", valor: (f) => f.unidad, ancho: 10 },
            { titulo: "Importe", valor: (f) => f.importe, tipo: "dinero" },
          ],
        }),
        ranking("Clientes", r.clientes),
        ranking("Vendedores", r.porVendedor),
        ranking("Sucursales", r.porSucursal),
        ranking("Categorías", r.categorias.map((c) => ({ nombre: c.nombre, total: c.importe }))),
        ranking("Formas de pago", r.porMetodo.map((m) => ({ nombre: ETIQUETA_METODO[m.metodo as Metodo] ?? m.metodo, total: m.total, ventas: m.pagos })), "Pagos"),
        ranking("Gastos", r.gastos.map((g) => ({ nombre: g.categoria, total: g.total }))),
      ];
    },
  },
};

/** Lee el periodo y la sucursal de la URL, limitados a lo que la persona puede ver. */
export function parametrosDe(sesion: Sesion, sp: URLSearchParams): Parametros {
  const hoy = hoyEnMexico();
  let desde = esFecha(sp.get("desde") ?? undefined) ? sp.get("desde")! : `${hoy.slice(0, 8)}01`;
  let hasta = esFecha(sp.get("hasta") ?? undefined) ? sp.get("hasta")! : hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  const sucursal = sesion.sucursales.find((s) => s.id === sp.get("sucursal"));
  return { desde, hasta, sucursalIds: sucursal ? [sucursal.id] : sesion.sucursales.map((s) => s.id) };
}

