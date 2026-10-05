import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { siguienteNumero } from "@/lib/almacen/existencias";
import type { Sesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { ErrorPac, obtenerPac, type ConceptoCfdi, type ReceptorCfdi } from "./pac";
import { baseSinIva, datosComplemento, erroresReceptor, FORMA_PAGO, formaYMetodo, RFC_PUBLICO_GENERAL } from "./reglas";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; mensaje: string };

/** El emisor necesita sus datos fiscales para timbrar. */
function faltaEmisor(sesion: Sesion) {
  const n = sesion.negocio;
  const faltan = [!n.rfc && "RFC", !n.razonSocial && "razón social", !n.regimenFiscal && "régimen fiscal", !n.codigoPostal && "código postal fiscal"].filter(Boolean);
  return faltan.length ? `Completa los datos fiscales del negocio (${faltan.join(", ")}) en Configuración › Negocio.` : null;
}

const mensajeDe = (e: unknown) => (e instanceof ErrorPac ? `El PAC rechazó la factura: ${e.message}` : "No se pudo conectar con el PAC. Inténtalo de nuevo.");

/** Ventas que ya están en una factura de ingreso vigente. */
export async function ventasFacturadas(ventaIds: string[]) {
  if (!ventaIds.length) return new Set<string>();
  const filas = await db
    .select({ ventaId: t.facturaVenta.ventaId })
    .from(t.facturaVenta)
    .innerJoin(t.factura, eq(t.factura.id, t.facturaVenta.facturaId))
    .where(and(inArray(t.facturaVenta.ventaId, ventaIds), eq(t.factura.estado, "vigente"), eq(t.factura.tipo, "I")));
  return new Set(filas.map((f) => f.ventaId));
}

// ─── Factura de una o varias ventas ─────────────────────────────────────────

export async function facturarVentas(sesion: Sesion, d: { ventaIds: string[]; usoCfdi: string | null; correo: string | null }): Promise<Resultado<{ id: string }>> {
  const sucursal = sesion.sucursal;
  if (!sucursal) return { ok: false, mensaje: "No tienes una sucursal asignada." };
  const falta = faltaEmisor(sesion);
  if (falta) return { ok: false, mensaje: falta };
  if (!d.ventaIds.length) return { ok: false, mensaje: "Elige al menos una venta." };

  const ventas = await db
    .select()
    .from(t.venta)
    .where(and(inArray(t.venta.id, d.ventaIds), eq(t.venta.negocioId, sesion.negocio.id)));
  if (ventas.length !== new Set(d.ventaIds).size) return { ok: false, mensaje: "Alguna venta ya no existe." };
  if (ventas.some((v) => v.estado !== "activa")) return { ok: false, mensaje: "No se pueden facturar ventas canceladas." };
  const clienteIds = new Set(ventas.map((v) => v.clienteId));
  if (clienteIds.size !== 1 || !ventas[0].clienteId) return { ok: false, mensaje: "Todas las ventas deben ser del mismo cliente (no de público en general)." };
  if ((await ventasFacturadas(d.ventaIds)).size) return { ok: false, mensaje: "Alguna venta ya está facturada." };

  const [cliente] = await db.select().from(t.cliente).where(eq(t.cliente.id, ventas[0].clienteId));
  const uso = d.usoCfdi ?? cliente.usoCfdi;
  const errores = erroresReceptor({ ...cliente, usoCfdi: uso });
  if (errores.length) return { ok: false, mensaje: `Al cliente le falta: ${errores.join(", ")}.` };

  const [partidas, pagos] = await Promise.all([
    db
      .select({ partida: t.ventaPartida, claveSat: t.producto.claveSat, claveUnidad: t.producto.claveUnidad, folio: t.venta.folio })
      .from(t.ventaPartida)
      .innerJoin(t.venta, eq(t.venta.id, t.ventaPartida.ventaId))
      .leftJoin(t.producto, eq(t.producto.id, t.ventaPartida.productoId))
      .where(inArray(t.ventaPartida.ventaId, d.ventaIds))
      .orderBy(asc(t.venta.creadoEn), asc(t.ventaPartida.orden)),
    db
      .select({ metodo: t.pago.metodo, monto: t.pago.monto })
      .from(t.pago)
      .where(and(inArray(t.pago.ventaId, d.ventaIds), eq(t.pago.cancelado, false))),
  ]);

  const conceptos: ConceptoCfdi[] = partidas.map(({ partida: p, claveSat, claveUnidad, folio }) => ({
    descripcion: p.notas ? `${p.descripcion} — ${p.notas.replace(/\s+/g, " ").slice(0, 200)}` : p.descripcion,
    // Conceptos libres: "Servicios de impresión" y unidad de servicio.
    claveProdServ: claveSat ?? "82121500",
    claveUnidad: claveUnidad ?? "E48",
    unidad: p.unidad,
    cantidad: p.cantidad,
    precioUnitario: p.precioUnitario,
    descuento: p.descuento,
    noIdentificacion: folio,
  }));
  const total = ventas.reduce((s, v) => s + v.total, 0);
  const { metodoPago, formaPago } = formaYMetodo(total, pagos);
  const receptor: ReceptorCfdi = {
    rfc: cliente.rfc!.toUpperCase(),
    nombre: cliente.razonSocial!.trim().toUpperCase(),
    regimen: cliente.regimenFiscal!,
    codigoPostal: cliente.codigoPostal!,
    uso: uso!,
    correo: d.correo ?? cliente.correo,
  };

  const pac = obtenerPac();
  const folio = await db.transaction((tx) => siguienteNumero(tx, sucursal.id, "factura"));
  let timbre;
  try {
    timbre = await pac.timbrar({
      tipo: "I",
      serie: sucursal.prefijoFolio,
      folio,
      receptor,
      conceptos,
      formaPago,
      metodoPago,
      ivaBp: sesion.negocio.ivaBp,
      ivaIncluido: sesion.negocio.preciosIncluyenIva,
    });
  } catch (e) {
    return { ok: false, mensaje: mensajeDe(e) };
  }

  const id = await db.transaction(async (tx) => {
    const [f] = await tx
      .insert(t.factura)
      .values({
        negocioId: sesion.negocio.id,
        sucursalId: sucursal.id,
        tipo: "I",
        clienteId: cliente.id,
        serie: sucursal.prefijoFolio,
        folio,
        uuid: timbre.uuid,
        pacId: timbre.pacId,
        receptor,
        conceptos,
        subtotal: ventas.reduce((s, v) => s + v.subtotal, 0),
        iva: ventas.reduce((s, v) => s + v.iva, 0),
        total,
        metodoPago,
        formaPago,
        usoCfdi: receptor.uso,
        simulada: timbre.simulada,
        xml: timbre.xml,
        usuarioId: sesion.usuario.id,
      })
      .returning({ id: t.factura.id });
    await tx.insert(t.facturaVenta).values(d.ventaIds.map((ventaId) => ({ facturaId: f.id, ventaId })));
    return f.id;
  });
  await registrar(sesion, "timbrar", "factura", id, { nombre: `${sucursal.prefijoFolio}-${folio}`, uuid: timbre.uuid, total, simulada: timbre.simulada });
  return { ok: true, id };
}

// ─── Factura global (público en general) ────────────────────────────────────

/** Ventas de la sucursal en el periodo, cobradas completas y sin factura: lo que ampara la global. */
export async function ventasParaGlobal(sesion: Sesion, inicio: Date, fin: Date) {
  if (!sesion.sucursal) return [];
  return db
    .select({ id: t.venta.id, folio: t.venta.folio, total: t.venta.total, subtotal: t.venta.subtotal, iva: t.venta.iva, creadoEn: t.venta.creadoEn })
    .from(t.venta)
    .where(
      and(
        eq(t.venta.sucursalId, sesion.sucursal.id),
        eq(t.venta.estado, "activa"),
        sql`${t.venta.pagado} >= ${t.venta.total}`,
        gte(t.venta.creadoEn, inicio),
        lt(t.venta.creadoEn, fin),
        sql`not exists (select 1 from ${t.facturaVenta} fv join ${t.factura} f on f.id = fv.factura_id where fv.venta_id = ${t.venta.id} and f.estado = 'vigente' and f.tipo = 'I')`,
      ),
    )
    .orderBy(asc(t.venta.creadoEn));
}

export async function facturaGlobal(
  sesion: Sesion,
  d: { inicio: Date; fin: Date; periodicidad: "day" | "week" | "fortnight" | "month" | "two_months"; meses: string; anio: number },
): Promise<Resultado<{ id: string; ventas: number }>> {
  const sucursal = sesion.sucursal;
  if (!sucursal) return { ok: false, mensaje: "No tienes una sucursal asignada." };
  const falta = faltaEmisor(sesion);
  if (falta) return { ok: false, mensaje: falta };
  const ventas = await ventasParaGlobal(sesion, d.inicio, d.fin);
  if (!ventas.length) return { ok: false, mensaje: "No hay ventas cobradas sin factura en ese periodo." };

  const pagos = await db
    .select({ metodo: t.pago.metodo, monto: t.pago.monto })
    .from(t.pago)
    .where(and(inArray(t.pago.ventaId, ventas.map((v) => v.id)), eq(t.pago.cancelado, false)));
  const total = ventas.reduce((s, v) => s + v.total, 0);
  const { formaPago } = formaYMetodo(total, pagos);
  // Reglas del SAT para la global: un concepto por venta, clave 01010101 y unidad ACT.
  const conceptos: ConceptoCfdi[] = ventas.map((v) => ({
    descripcion: "Venta",
    claveProdServ: "01010101",
    claveUnidad: "ACT",
    unidad: "Actividad",
    cantidad: 1,
    precioUnitario: v.total,
    descuento: 0,
    noIdentificacion: v.folio,
  }));
  const receptor: ReceptorCfdi = { rfc: RFC_PUBLICO_GENERAL, nombre: "PUBLICO EN GENERAL", regimen: "616", codigoPostal: sesion.negocio.codigoPostal!, uso: "S01" };

  const folio = await db.transaction((tx) => siguienteNumero(tx, sucursal.id, "factura"));
  let timbre;
  try {
    timbre = await obtenerPac().timbrar({
      tipo: "I",
      serie: sucursal.prefijoFolio,
      folio,
      receptor,
      conceptos,
      formaPago,
      metodoPago: "PUE",
      ivaBp: sesion.negocio.ivaBp,
      ivaIncluido: true,
      global: { periodicidad: d.periodicidad, meses: d.meses, anio: d.anio },
    });
  } catch (e) {
    return { ok: false, mensaje: mensajeDe(e) };
  }

  const id = await db.transaction(async (tx) => {
    const [f] = await tx
      .insert(t.factura)
      .values({
        negocioId: sesion.negocio.id,
        sucursalId: sucursal.id,
        tipo: "I",
        clienteId: null,
        serie: sucursal.prefijoFolio,
        folio,
        uuid: timbre.uuid,
        pacId: timbre.pacId,
        receptor,
        conceptos,
        subtotal: ventas.reduce((s, v) => s + v.subtotal, 0),
        iva: ventas.reduce((s, v) => s + v.iva, 0),
        total,
        metodoPago: "PUE",
        formaPago,
        usoCfdi: "S01",
        global: d,
        simulada: timbre.simulada,
        xml: timbre.xml,
        usuarioId: sesion.usuario.id,
      })
      .returning({ id: t.factura.id });
    await tx.insert(t.facturaVenta).values(ventas.map((v) => ({ facturaId: f.id, ventaId: v.id })));
    return f.id;
  });
  await registrar(sesion, "timbrar", "factura", id, { nombre: `Global ${sucursal.prefijoFolio}-${folio}`, ventas: ventas.length, total });
  return { ok: true, id, ventas: ventas.length };
}

// ─── Complementos de pago ───────────────────────────────────────────────────

/** Pagos de las ventas de una factura PPD que aún no tienen complemento, en orden. */
export async function pagosSinComplemento(facturaId: string) {
  return db
    .select({ id: t.pago.id, metodo: t.pago.metodo, monto: t.pago.monto, creadoEn: t.pago.creadoEn, folio: t.venta.folio })
    .from(t.pago)
    .innerJoin(t.facturaVenta, and(eq(t.facturaVenta.ventaId, t.pago.ventaId), eq(t.facturaVenta.facturaId, facturaId)))
    .innerJoin(t.venta, eq(t.venta.id, t.pago.ventaId))
    .innerJoin(t.factura, eq(t.factura.id, facturaId))
    .leftJoin(t.complementoPago, and(eq(t.complementoPago.pagoId, t.pago.id), eq(t.complementoPago.facturaId, facturaId)))
    // Solo pagos posteriores a la factura: los anteriores ya iban en ella.
    .where(and(eq(t.pago.cancelado, false), isNull(t.complementoPago.id), sql`${t.pago.creadoEn} > ${t.factura.creadoEn}`))
    .orderBy(asc(t.pago.creadoEn));
}

export async function emitirComplemento(sesion: Sesion, facturaId: string, pagoId: string): Promise<Resultado<{ id: string }>> {
  const sucursal = sesion.sucursal;
  if (!sucursal) return { ok: false, mensaje: "No tienes una sucursal asignada." };
  const [f] = await db.select().from(t.factura).where(and(eq(t.factura.id, facturaId), eq(t.factura.negocioId, sesion.negocio.id)));
  if (!f || f.tipo !== "I" || f.estado !== "vigente" || f.metodoPago !== "PPD") return { ok: false, mensaje: "Solo las facturas PPD vigentes llevan complemento de pago." };
  const pendiente = (await pagosSinComplemento(facturaId)).find((p) => p.id === pagoId);
  if (!pendiente) return { ok: false, mensaje: "Ese pago ya tiene complemento o no pertenece a esta factura." };

  const previos = await db.select({ monto: t.complementoPago.monto }).from(t.complementoPago).where(eq(t.complementoPago.facturaId, facturaId));
  // Lo cobrado antes de facturar se resta del total para obtener el saldo que ampara la factura.
  const [{ pagadoAntes }] = await db
    .select({ pagadoAntes: sql<number>`coalesce(sum(${t.pago.monto}), 0)::int` })
    .from(t.pago)
    .innerJoin(t.facturaVenta, and(eq(t.facturaVenta.ventaId, t.pago.ventaId), eq(t.facturaVenta.facturaId, facturaId)))
    .where(and(eq(t.pago.cancelado, false), sql`${t.pago.creadoEn} <= ${f.creadoEn}`));
  const datos = datosComplemento(f.total - pagadoAntes, previos.map((p) => p.monto), pendiente.monto);
  const receptor = f.receptor as ReceptorCfdi;
  const documento = { uuid: f.uuid!, monto: pendiente.monto, parcialidad: datos.parcialidad, saldoAnterior: datos.saldoAnterior, base: baseSinIva(pendiente.monto, sesion.negocio.ivaBp) };

  const folio = await db.transaction((tx) => siguienteNumero(tx, sucursal.id, "complemento"));
  const serie = `${sucursal.prefijoFolio}P`;
  let timbre;
  try {
    timbre = await obtenerPac().timbrar({
      tipo: "P",
      serie,
      folio,
      receptor: { ...receptor, uso: "CP01" },
      formaPago: FORMA_PAGO[pendiente.metodo] ?? "99",
      fecha: pendiente.creadoEn,
      documentos: [documento],
      ivaBp: sesion.negocio.ivaBp,
    });
  } catch (e) {
    return { ok: false, mensaje: mensajeDe(e) };
  }

  const id = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(t.factura)
      .values({
        negocioId: sesion.negocio.id,
        sucursalId: sucursal.id,
        tipo: "P",
        clienteId: f.clienteId,
        serie,
        folio,
        uuid: timbre.uuid,
        pacId: timbre.pacId,
        receptor: { ...receptor, uso: "CP01" },
        conceptos: [documento],
        subtotal: 0,
        iva: 0,
        total: 0,
        usoCfdi: "CP01",
        formaPago: FORMA_PAGO[pendiente.metodo] ?? "99",
        simulada: timbre.simulada,
        xml: timbre.xml,
        usuarioId: sesion.usuario.id,
      })
      .returning({ id: t.factura.id });
    await tx.insert(t.complementoPago).values({ comprobanteId: p.id, facturaId, pagoId, parcialidad: datos.parcialidad, saldoAnterior: datos.saldoAnterior, monto: pendiente.monto, saldoInsoluto: datos.saldoInsoluto });
    return p.id;
  });
  await registrar(sesion, "timbrar", "complemento", id, { nombre: `${serie}-${folio}`, factura: `${f.serie}-${f.folio}`, monto: pendiente.monto });
  return { ok: true, id };
}

// ─── Cancelación ────────────────────────────────────────────────────────────

export async function cancelarFactura(sesion: Sesion, id: string, motivo: string, sustitucion: string | null): Promise<Resultado> {
  const [f] = await db.select().from(t.factura).where(and(eq(t.factura.id, id), eq(t.factura.negocioId, sesion.negocio.id)));
  if (!f || f.estado !== "vigente") return { ok: false, mensaje: "La factura no existe o ya está cancelada." };
  if (motivo === "01" && !sustitucion) return { ok: false, mensaje: "Con el motivo 01 indica el UUID de la factura que la sustituye." };
  if (f.tipo === "I") {
    const complementos = await db
      .select({ id: t.complementoPago.id })
      .from(t.complementoPago)
      .innerJoin(t.factura, eq(t.factura.id, t.complementoPago.comprobanteId))
      .where(and(eq(t.complementoPago.facturaId, id), eq(t.factura.estado, "vigente")));
    if (complementos.length) return { ok: false, mensaje: "Primero cancela los complementos de pago de esta factura." };
  }

  try {
    if (f.pacId) await obtenerPac().cancelar(f.pacId, motivo, sustitucion);
  } catch (e) {
    return { ok: false, mensaje: e instanceof ErrorPac ? `El PAC no la canceló: ${e.message}` : "No se pudo conectar con el PAC." };
  }
  await db.update(t.factura).set({ estado: "cancelada", motivoCancelacion: motivo, sustituidaPor: sustitucion, canceladaEn: new Date() }).where(eq(t.factura.id, id));
  await registrar(sesion, "cancelar", "factura", id, { nombre: `${f.serie}-${f.folio}`, motivo });
  return { ok: true };
}

