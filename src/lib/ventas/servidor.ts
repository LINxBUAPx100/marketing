import "server-only";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, t } from "@/db";
import type { Sesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { moverExistencia, moverInsumo, siguienteFolio } from "@/lib/almacen/existencias";
import { consumoDeInsumos, costoPartida, ingresoSinIva } from "@/lib/almacen/reglas";
import { devolverInsumosDeVenta, recetasDe } from "@/lib/almacen/servidor";
import type { Metodo } from "@/lib/caja/resumen";
import { cancelarOrdenDeVenta, crearOrden, etapasDe } from "@/lib/produccion/servidor";
import { estadoCotizacion } from "@/lib/produccion/reglas";
import { calcularTotales, importePartida, validarPagos, validarPartida } from "./calculo";
import { comisionDe, precioPara, rebasaLimite } from "./precios";
import { reglasDeCliente, volumenDe } from "./reglas-cliente";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; mensaje: string };

export type PartidaEntrada = {
  productoId: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  notas: string | null;
};

export type PagoEntrada = { metodo: Metodo; monto: number; recibido: number | null; referencia: string | null };

export type VentaEntrada = {
  clienteId: string | null;
  fechaEntrega: Date | null;
  notas: string | null;
  partidas: PartidaEntrada[];
  pagos: PagoEntrada[];
  /** Crear orden de trabajo para el taller. */
  enviarProduccion: boolean;
  /** Si la venta viene de una cotización: respeta sus precios y la marca como aceptada. */
  cotizacionId: string | null;
};

export async function crearVenta(sesion: Sesion, entrada: VentaEntrada): Promise<Resultado<{ id: string; folio: string }>> {
  const sucursal = sesion.sucursal;
  if (!sucursal) return { ok: false, mensaje: "No tienes una sucursal asignada." };
  if (!entrada.partidas.length) return { ok: false, mensaje: "Agrega al menos un producto o concepto." };

  const negocioId = sesion.negocio.id;
  const cliente = entrada.clienteId
    ? (await db.select().from(t.cliente).where(and(eq(t.cliente.id, entrada.clienteId), eq(t.cliente.negocioId, negocioId))))[0]
    : null;
  if (entrada.clienteId && !cliente) return { ok: false, mensaje: "El cliente ya no existe." };

  const ids = entrada.partidas.map((p) => p.productoId).filter((id): id is string => !!id);
  const productos = ids.length
    ? await db.select().from(t.producto).where(and(inArray(t.producto.id, ids), eq(t.producto.negocioId, negocioId)))
    : [];
  const porId = new Map(productos.map((p) => [p.id, p]));
  const puedeDescontar = sesion.puede("ventas.descuento");
  const [reglasCliente, volumen] = await Promise.all([reglasDeCliente(negocioId, cliente?.id ?? null), volumenDe(ids)]);
  if (!reglasCliente) return { ok: false, mensaje: "El cliente ya no existe." };

  // Precios ya autorizados en una cotización vigente del mismo cliente.
  const cotizado = new Map<string, { precioUnitario: number; descuento: number }>();
  if (entrada.cotizacionId) {
    const [c] = await db
      .select()
      .from(t.cotizacion)
      .where(and(eq(t.cotizacion.id, entrada.cotizacionId), eq(t.cotizacion.negocioId, negocioId)));
    if (!c || c.estado !== "abierta") return { ok: false, mensaje: "La cotización ya no está abierta." };
    if (c.clienteId !== cliente?.id) return { ok: false, mensaje: "La venta debe ser para el mismo cliente de la cotización." };
    if (estadoCotizacion(c) === "abierta") {
      const lineas = await db.select().from(t.cotizacionPartida).where(eq(t.cotizacionPartida.cotizacionId, c.id));
      for (const l of lineas) if (l.productoId) cotizado.set(l.productoId, { precioUnitario: l.precioUnitario, descuento: l.descuento });
    }
  }

  // El servidor decide descripción, unidad y precio de lista; el cliente solo propone.
  type Producto = (typeof productos)[number];
  const partidas: (PartidaEntrada & { unidad: string; importe: number; producto: Producto | null | undefined; orden: number })[] = [];
  for (const [i, p] of entrada.partidas.entries()) {
    const producto = p.productoId ? porId.get(p.productoId) : null;
    if (p.productoId && (!producto || !producto.activo)) return { ok: false, mensaje: "Un producto ya no está disponible. Quítalo e inténtalo de nuevo." };

    if (producto) {
      // Convenio, volumen o lista: la misma regla que ve el punto de venta.
      const lista = precioPara({ ...producto, volumen: volumen.get(producto.id) ?? [] }, p.cantidad, reglasCliente.reglas).precio;
      const autorizado = cotizado.get(producto.id);
      const comoCotizado = !!autorizado && p.precioUnitario === autorizado.precioUnitario && p.descuento <= autorizado.descuento;
      if ((p.precioUnitario !== lista || p.descuento > 0) && !puedeDescontar && !comoCotizado) {
        return { ok: false, mensaje: `No tienes permiso para cambiar el precio de "${producto.nombre}".` };
      }
    } else if (!p.descripcion.trim()) {
      return { ok: false, mensaje: "Escribe la descripción del concepto libre." };
    }

    const error = validarPartida(p);
    if (error) return { ok: false, mensaje: `${producto?.nombre ?? p.descripcion}: ${error}` };
    partidas.push({
      ...p,
      descripcion: producto?.nombre ?? p.descripcion.trim(),
      unidad: producto?.unidad ?? "servicio",
      importe: importePartida(p),
      producto,
      orden: i,
    });
  }

  const totales = calcularTotales(partidas, sesion.negocio);
  const errorPagos = validarPagos(entrada.pagos, totales.total);
  if (errorPagos) return { ok: false, mensaje: errorPagos };
  const pagado = entrada.pagos.reduce((s, p) => s + p.monto, 0);
  if (pagado < totales.total && !cliente) {
    return { ok: false, mensaje: "Para dejar saldo pendiente, elige a qué cliente se le cobra." };
  }
  // Límite de crédito del convenio. Solo la administración puede rebasarlo.
  if (rebasaLimite(reglasCliente.saldo, totales.total - pagado, reglasCliente.limiteCredito) && !sesion.rol.esAdmin) {
    return {
      ok: false,
      mensaje: `${cliente?.nombre} rebasaría su límite de crédito de ${(reglasCliente.limiteCredito! / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}: ya debe ${(reglasCliente.saldo / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}. Cobra más ahora o pide autorización.`,
    };
  }

  // Comisión: la de la categoría del producto si tiene una propia; si no, la del vendedor.
  const idsCategoria = [...new Set(productos.map((p) => p.categoriaId).filter((x): x is string => !!x))];
  const categorias = idsCategoria.length ? await db.select({ id: t.categoria.id, comisionBp: t.categoria.comisionBp }).from(t.categoria).where(inArray(t.categoria.id, idsCategoria)) : [];
  const comisionCategoria = new Map(categorias.map((c) => [c.id, c.comisionBp]));
  const comisiones = partidas
    .map((p) => {
      const bp = (p.producto?.categoriaId ? comisionCategoria.get(p.producto.categoriaId) : null) ?? sesion.usuario.comisionBp;
      const base = ingresoSinIva(p.importe, sesion.negocio);
      return { bp, base, monto: comisionDe(base, bp) };
    })
    .filter((c) => c.monto > 0);

  // Costo de cada partida (receta o costo del producto) y consumo de insumos de la venta.
  const recetas = await recetasDe(db, productos.map((p) => p.id));
  const costos = partidas.map((p) => (p.producto ? costoPartida(p.cantidad, recetas.get(p.producto.id) ?? [], p.producto.costo) : null));
  const consumo = consumoDeInsumos(
    partidas.map((p) => ({ productoId: p.producto?.id ?? null, cantidad: p.cantidad })),
    recetas,
  );

  const etapas = entrada.enviarProduccion ? await etapasDe(negocioId) : [];
  const etapaInicial = etapas.find((e) => e.tipo === "proceso") ?? etapas[0];

  const venta = await db.transaction(async (tx) => {
    const folio = await siguienteFolio(tx, sucursal.id, sucursal.prefijoFolio, "venta");
    const [v] = await tx
      .insert(t.venta)
      .values({
        negocioId,
        sucursalId: sucursal.id,
        folio,
        clienteId: cliente?.id ?? null,
        usuarioId: sesion.usuario.id,
        subtotal: totales.subtotal,
        descuento: totales.descuento,
        iva: totales.iva,
        total: totales.total,
        pagado,
        fechaEntrega: entrada.fechaEntrega,
        notas: entrada.notas,
      })
      .returning();

    await tx.insert(t.ventaPartida).values(
      partidas.map((p, i) => ({
        ventaId: v.id,
        costo: costos[i],
        productoId: p.producto?.id ?? null,
        descripcion: p.descripcion,
        unidad: p.unidad,
        cantidad: p.cantidad,
        precioUnitario: p.precioUnitario,
        descuento: p.descuento,
        importe: p.importe,
        notas: p.notas,
        orden: p.orden,
      })),
    );

    if (comisiones.length) {
      await tx.insert(t.comision).values(comisiones.map((c) => ({ ...c, negocioId, ventaId: v.id, usuarioId: sesion.usuario.id })));
    }

    for (const [insumoId, cantidad] of consumo) {
      await moverInsumo(tx, { negocioId, sucursalId: sucursal.id, insumoId, cantidad: -cantidad, motivo: "consumo", ventaId: v.id, usuarioId: sesion.usuario.id });
    }

    if (etapaInicial) {
      await crearOrden(tx, {
        negocioId,
        sucursalId: sucursal.id,
        ventaId: v.id,
        folio,
        fechaCompromiso: entrada.fechaEntrega,
        usuarioId: sesion.usuario.id,
        etapaInicial,
      });
    }
    if (entrada.cotizacionId) {
      await tx
        .update(t.cotizacion)
        .set({ estado: "aceptada", ventaId: v.id, actualizadoEn: new Date() })
        .where(eq(t.cotizacion.id, entrada.cotizacionId));
    }

    if (entrada.pagos.length) {
      await tx.insert(t.pago).values(
        entrada.pagos.map((p) => ({ ...p, negocioId, sucursalId: sucursal.id, ventaId: v.id, usuarioId: sesion.usuario.id })),
      );
    }

    for (const p of partidas) {
      if (p.producto?.tipo !== "producto") continue;
      await moverExistencia(tx, {
        negocioId,
        sucursalId: sucursal.id,
        productoId: p.producto.id,
        cantidad: -p.cantidad,
        motivo: "venta",
        ventaId: v.id,
        usuarioId: sesion.usuario.id,
      });
    }
    return v;
  });

  await registrar(sesion, "crear", "venta", venta.id, { nombre: venta.folio, total: venta.total, pagado });
  return { ok: true, id: venta.id, folio: venta.folio };
}

export async function registrarAbono(sesion: Sesion, ventaId: string, pagos: PagoEntrada[]): Promise<Resultado> {
  const sucursal = sesion.sucursal;
  if (!sucursal) return { ok: false, mensaje: "No tienes una sucursal asignada." };
  if (!pagos.length) return { ok: false, mensaje: "Agrega el pago." };

  const [venta] = await db
    .select()
    .from(t.venta)
    .where(and(eq(t.venta.id, ventaId), eq(t.venta.negocioId, sesion.negocio.id)));
  if (!venta || venta.estado !== "activa") return { ok: false, mensaje: "La venta no existe o está cancelada." };

  const error = validarPagos(pagos, venta.total - venta.pagado);
  if (error) return { ok: false, mensaje: error };
  const monto = pagos.reduce((s, p) => s + p.monto, 0);

  await db.transaction(async (tx) => {
    await tx.insert(t.pago).values(
      pagos.map((p) => ({ ...p, negocioId: sesion.negocio.id, sucursalId: sucursal.id, ventaId, usuarioId: sesion.usuario.id })),
    );
    await tx.update(t.venta).set({ pagado: sql`${t.venta.pagado} + ${monto}` }).where(eq(t.venta.id, ventaId));
  });

  await registrar(sesion, "abonar", "venta", ventaId, { nombre: venta.folio, monto });
  return { ok: true };
}

export async function cancelarVenta(sesion: Sesion, ventaId: string, motivo: string): Promise<Resultado> {
  const sucursal = sesion.sucursal;
  if (!sucursal) return { ok: false, mensaje: "No tienes una sucursal asignada." };

  const [venta] = await db
    .select()
    .from(t.venta)
    .where(and(eq(t.venta.id, ventaId), eq(t.venta.negocioId, sesion.negocio.id)));
  if (!venta || venta.estado !== "activa") return { ok: false, mensaje: "La venta no existe o ya está cancelada." };
  const [facturada] = await db
    .select({ serie: t.factura.serie, folio: t.factura.folio })
    .from(t.facturaVenta)
    .innerJoin(t.factura, eq(t.factura.id, t.facturaVenta.facturaId))
    .where(and(eq(t.facturaVenta.ventaId, ventaId), eq(t.factura.estado, "vigente"), eq(t.factura.tipo, "I")));
  if (facturada) return { ok: false, mensaje: `Primero cancela la factura ${facturada.serie}-${facturada.folio} de esta venta.` };

  await db.transaction(async (tx) => {
    await tx
      .update(t.venta)
      .set({ estado: "cancelada", motivoCancelacion: motivo, canceladaPor: sesion.usuario.id, canceladaEn: new Date() })
      .where(eq(t.venta.id, ventaId));
    await cancelarOrdenDeVenta(tx, ventaId);
    await devolverInsumosDeVenta(tx, { negocioId: sesion.negocio.id, ventaId, usuarioId: sesion.usuario.id });
    await tx
      .update(t.comision)
      .set({ estado: "cancelada" })
      .where(and(eq(t.comision.ventaId, ventaId), eq(t.comision.estado, "pendiente")));

    // Pagos del periodo abierto: se anulan y dejan de contar en la caja.
    await tx
      .update(t.pago)
      .set({ cancelado: true })
      .where(and(eq(t.pago.ventaId, ventaId), isNull(t.pago.corteId)));

    // Pagos que ya entraron en un corte: se devuelven como gasto del periodo actual.
    const cortados = await tx
      .select({ metodo: t.pago.metodo, monto: sql<number>`sum(${t.pago.monto})::int` })
      .from(t.pago)
      .where(and(eq(t.pago.ventaId, ventaId), isNotNull(t.pago.corteId), eq(t.pago.cancelado, false)))
      .groupBy(t.pago.metodo);
    for (const c of cortados) {
      await tx.insert(t.movimientoCaja).values({
        negocioId: sesion.negocio.id,
        sucursalId: sucursal.id,
        tipo: "egreso",
        categoria: "Devolución",
        concepto: `Devolución por cancelación de ${venta.folio}`,
        metodo: c.metodo,
        monto: c.monto,
        ventaId,
        usuarioId: sesion.usuario.id,
      });
    }

    // Lo vendido regresa al inventario de la sucursal donde se vendió.
    const partidas = await tx
      .select({ productoId: t.ventaPartida.productoId, cantidad: t.ventaPartida.cantidad, tipo: t.producto.tipo })
      .from(t.ventaPartida)
      .innerJoin(t.producto, eq(t.producto.id, t.ventaPartida.productoId))
      .where(eq(t.ventaPartida.ventaId, ventaId));
    for (const p of partidas) {
      if (p.tipo !== "producto" || !p.productoId) continue;
      await moverExistencia(tx, {
        negocioId: sesion.negocio.id,
        sucursalId: venta.sucursalId,
        productoId: p.productoId,
        cantidad: p.cantidad,
        motivo: "cancelacion",
        ventaId,
        usuarioId: sesion.usuario.id,
      });
    }
  });

  await registrar(sesion, "cancelar", "venta", ventaId, { nombre: venta.folio, motivo });
  return { ok: true };
}
