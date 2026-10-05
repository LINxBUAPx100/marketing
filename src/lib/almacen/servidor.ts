import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, t } from "@/db";
import type { Sesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import type { Metodo } from "@/lib/caja/resumen";
import { moverExistencia, moverInsumo, siguienteFolio, type Tx } from "./existencias";
import { redondear3, type RenglonReceta } from "./reglas";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; mensaje: string };

/** Recetas de varios productos con el costo actual de cada insumo. */
export async function recetasDe(cx: typeof db | Tx, productoIds: string[]) {
  const mapa = new Map<string, RenglonReceta[]>();
  if (!productoIds.length) return mapa;
  const filas = await cx
    .select({ productoId: t.receta.productoId, insumoId: t.receta.insumoId, cantidad: t.receta.cantidad, costoInsumo: t.insumo.costo })
    .from(t.receta)
    .innerJoin(t.insumo, eq(t.insumo.id, t.receta.insumoId))
    .where(inArray(t.receta.productoId, productoIds));
  for (const f of filas) {
    const lista = mapa.get(f.productoId) ?? [];
    lista.push({ insumoId: f.insumoId, cantidad: f.cantidad, costoInsumo: f.costoInsumo });
    mapa.set(f.productoId, lista);
  }
  return mapa;
}

/** Regresa los insumos que consumió una venta (al cancelarla). */
export async function devolverInsumosDeVenta(tx: Tx, d: { negocioId: string; ventaId: string; usuarioId: string }) {
  const consumos = await tx
    .select()
    .from(t.movimientoInsumo)
    .where(and(eq(t.movimientoInsumo.ventaId, d.ventaId), eq(t.movimientoInsumo.motivo, "consumo")));
  for (const c of consumos) {
    await moverInsumo(tx, { negocioId: d.negocioId, sucursalId: c.sucursalId, insumoId: c.insumoId, cantidad: -c.cantidad, motivo: "cancelacion", ventaId: d.ventaId, usuarioId: d.usuarioId });
  }
}

// ─── Compras ────────────────────────────────────────────────────────────────

export type ArticuloEntrada = { tipo: "insumo" | "producto"; id: string; cantidad: number };
export type PagoProveedorEntrada = { metodo: Metodo; monto: number; referencia: string | null; desdeCaja: boolean };

export type CompraEntrada = {
  proveedorId: string;
  referencia: string | null;
  fecha: Date;
  diasCredito: number;
  notas: string | null;
  actualizarCostos: boolean;
  partidas: (ArticuloEntrada & { costoUnitario: number })[];
  pago: PagoProveedorEntrada | null;
};

/** Verifica que los artículos existan en el negocio. Devuelve sus nombres por id. */
async function validarArticulos(negocioId: string, partidas: ArticuloEntrada[]) {
  const idsInsumo = partidas.filter((p) => p.tipo === "insumo").map((p) => p.id);
  const idsProducto = partidas.filter((p) => p.tipo === "producto").map((p) => p.id);
  const [insumos, productos] = await Promise.all([
    idsInsumo.length ? db.select({ id: t.insumo.id, nombre: t.insumo.nombre }).from(t.insumo).where(and(inArray(t.insumo.id, idsInsumo), eq(t.insumo.negocioId, negocioId))) : [],
    idsProducto.length
      ? db
          .select({ id: t.producto.id, nombre: t.producto.nombre, tipo: t.producto.tipo })
          .from(t.producto)
          .where(and(inArray(t.producto.id, idsProducto), eq(t.producto.negocioId, negocioId)))
      : [],
  ]);
  if (insumos.length !== new Set(idsInsumo).size || productos.length !== new Set(idsProducto).size) return null;
  if (productos.some((p) => p.tipo !== "producto")) return null; // los servicios no tienen existencias
  return new Map([...insumos, ...productos].map((a) => [a.id, a.nombre]));
}

async function pagarEnTx(tx: Tx, sesion: Sesion, compra: { id: string; negocioId: string }, proveedor: string, pago: PagoProveedorEntrada) {
  let movimientoCajaId: string | null = null;
  if (pago.desdeCaja && sesion.sucursal) {
    const [m] = await tx
      .insert(t.movimientoCaja)
      .values({
        negocioId: compra.negocioId,
        sucursalId: sesion.sucursal.id,
        tipo: "egreso",
        categoria: "Pago a proveedor",
        concepto: `Pago a ${proveedor}${pago.referencia ? ` (${pago.referencia})` : ""}`,
        metodo: pago.metodo,
        monto: pago.monto,
        usuarioId: sesion.usuario.id,
      })
      .returning({ id: t.movimientoCaja.id });
    movimientoCajaId = m.id;
  }
  await tx.insert(t.pagoProveedor).values({
    negocioId: compra.negocioId,
    compraId: compra.id,
    metodo: pago.metodo,
    monto: pago.monto,
    referencia: pago.referencia,
    movimientoCajaId,
    usuarioId: sesion.usuario.id,
  });
  await tx.update(t.compra).set({ pagado: sql`${t.compra.pagado} + ${pago.monto}` }).where(eq(t.compra.id, compra.id));
}

export async function registrarCompra(sesion: Sesion, entrada: CompraEntrada): Promise<Resultado<{ id: string }>> {
  const sucursal = sesion.sucursal;
  if (!sucursal) return { ok: false, mensaje: "No tienes una sucursal asignada." };
  if (!entrada.partidas.length) return { ok: false, mensaje: "Agrega lo que se compró." };
  const negocioId = sesion.negocio.id;

  const [prov] = await db.select().from(t.proveedor).where(and(eq(t.proveedor.id, entrada.proveedorId), eq(t.proveedor.negocioId, negocioId)));
  if (!prov) return { ok: false, mensaje: "Elige el proveedor." };
  if (!(await validarArticulos(negocioId, entrada.partidas))) return { ok: false, mensaje: "Algún artículo ya no existe o es un servicio sin existencias." };

  const partidas = entrada.partidas.map((p) => ({ ...p, importe: Math.round(p.cantidad * p.costoUnitario) }));
  const total = partidas.reduce((s, p) => s + p.importe, 0);
  if (entrada.pago && entrada.pago.monto > total) return { ok: false, mensaje: "El pago es mayor que el total de la compra." };
  const vencimiento = new Date(entrada.fecha.getTime() + entrada.diasCredito * 86_400_000);

  const id = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(t.compra)
      .values({ negocioId, sucursalId: sucursal.id, proveedorId: prov.id, referencia: entrada.referencia, fecha: entrada.fecha, vencimiento, total, notas: entrada.notas, usuarioId: sesion.usuario.id })
      .returning();
    await tx.insert(t.compraPartida).values(
      partidas.map((p) => ({
        compraId: c.id,
        insumoId: p.tipo === "insumo" ? p.id : null,
        productoId: p.tipo === "producto" ? p.id : null,
        cantidad: p.cantidad,
        costoUnitario: p.costoUnitario,
        importe: p.importe,
      })),
    );
    for (const p of partidas) {
      const base = { negocioId, sucursalId: sucursal.id, cantidad: p.cantidad, usuarioId: sesion.usuario.id, compraId: c.id };
      if (p.tipo === "insumo") {
        await moverInsumo(tx, { ...base, insumoId: p.id, motivo: "compra" });
        if (entrada.actualizarCostos) await tx.update(t.insumo).set({ costo: p.costoUnitario }).where(eq(t.insumo.id, p.id));
      } else {
        await moverExistencia(tx, { ...base, productoId: p.id, motivo: "compra" });
        if (entrada.actualizarCostos) await tx.update(t.producto).set({ costo: Math.round(p.costoUnitario) }).where(eq(t.producto.id, p.id));
      }
    }
    if (entrada.pago?.monto) await pagarEnTx(tx, sesion, c, prov.nombre, entrada.pago);
    return c.id;
  });

  await registrar(sesion, "crear", "compra", id, { nombre: prov.nombre, total });
  return { ok: true, id };
}

export async function pagarCompra(sesion: Sesion, compraId: string, pago: PagoProveedorEntrada): Promise<Resultado> {
  const [fila] = await db
    .select({ compra: t.compra, proveedor: t.proveedor.nombre })
    .from(t.compra)
    .innerJoin(t.proveedor, eq(t.proveedor.id, t.compra.proveedorId))
    .where(and(eq(t.compra.id, compraId), eq(t.compra.negocioId, sesion.negocio.id)));
  if (!fila || fila.compra.estado !== "activa") return { ok: false, mensaje: "La compra no existe o está cancelada." };
  const saldo = fila.compra.total - fila.compra.pagado;
  if (pago.monto <= 0 || pago.monto > saldo) return { ok: false, mensaje: `El pago debe ser mayor que cero y no pasar del saldo.` };
  if (pago.desdeCaja && !sesion.sucursal) return { ok: false, mensaje: "No tienes una caja asignada." };

  await db.transaction((tx) => pagarEnTx(tx, sesion, fila.compra, fila.proveedor, pago));
  await registrar(sesion, "pagar", "compra", compraId, { nombre: fila.proveedor, monto: pago.monto });
  return { ok: true };
}

export async function cancelarCompra(sesion: Sesion, compraId: string, motivo: string): Promise<Resultado> {
  const [c] = await db.select().from(t.compra).where(and(eq(t.compra.id, compraId), eq(t.compra.negocioId, sesion.negocio.id)));
  if (!c || c.estado !== "activa") return { ok: false, mensaje: "La compra no existe o ya está cancelada." };
  if (c.pagado > 0) return { ok: false, mensaje: "Ya tiene pagos registrados. Pide una nota de crédito al proveedor y regístrala como ajuste." };

  await db.transaction(async (tx) => {
    await tx.update(t.compra).set({ estado: "cancelada", motivoCancelacion: motivo }).where(eq(t.compra.id, compraId));
    const partidas = await tx.select().from(t.compraPartida).where(eq(t.compraPartida.compraId, compraId));
    for (const p of partidas) {
      const base = { negocioId: c.negocioId, sucursalId: c.sucursalId, cantidad: -p.cantidad, usuarioId: sesion.usuario.id, compraId, nota: motivo };
      if (p.insumoId) await moverInsumo(tx, { ...base, insumoId: p.insumoId, motivo: "compra_cancelada" });
      if (p.productoId) await moverExistencia(tx, { ...base, productoId: p.productoId, motivo: "compra_cancelada" });
    }
  });
  await registrar(sesion, "cancelar", "compra", compraId, { motivo });
  return { ok: true };
}

// ─── Traspasos ──────────────────────────────────────────────────────────────

export async function registrarTraspaso(
  sesion: Sesion,
  entrada: { origenId: string; destinoId: string; notas: string | null; partidas: ArticuloEntrada[] },
): Promise<Resultado<{ id: string; folio: string }>> {
  if (entrada.origenId === entrada.destinoId) return { ok: false, mensaje: "El origen y el destino deben ser sucursales distintas." };
  if (!entrada.partidas.length) return { ok: false, mensaje: "Agrega lo que se va a traspasar." };
  const negocioId = sesion.negocio.id;

  const sucursales = await db
    .select()
    .from(t.sucursal)
    .where(and(inArray(t.sucursal.id, [entrada.origenId, entrada.destinoId]), eq(t.sucursal.negocioId, negocioId), eq(t.sucursal.activa, true)));
  const origen = sucursales.find((s) => s.id === entrada.origenId);
  const destino = sucursales.find((s) => s.id === entrada.destinoId);
  if (!origen || !destino) return { ok: false, mensaje: "Elige sucursales activas." };
  if (!sesion.rol.esAdmin && !sesion.sucursales.some((s) => s.id === origen.id)) return { ok: false, mensaje: "Solo puedes traspasar desde tus sucursales." };
  if (!(await validarArticulos(negocioId, entrada.partidas))) return { ok: false, mensaje: "Algún artículo ya no existe o es un servicio sin existencias." };

  const resultado = await db.transaction(async (tx) => {
    const folio = await siguienteFolio(tx, origen.id, `${origen.prefijoFolio}-T`, "traspaso");
    const [tr] = await tx
      .insert(t.traspaso)
      .values({ negocioId, folio, origenId: origen.id, destinoId: destino.id, notas: entrada.notas, usuarioId: sesion.usuario.id })
      .returning();
    for (const p of entrada.partidas) {
      const cantidad = redondear3(p.cantidad);
      await tx.insert(t.traspasoPartida).values({ traspasoId: tr.id, insumoId: p.tipo === "insumo" ? p.id : null, productoId: p.tipo === "producto" ? p.id : null, cantidad });
      for (const [sucursalId, signo] of [
        [origen.id, -1],
        [destino.id, 1],
      ] as const) {
        const base = { negocioId, sucursalId, cantidad: signo * cantidad, usuarioId: sesion.usuario.id, traspasoId: tr.id, nota: `${folio}: ${origen.nombre} → ${destino.nombre}` };
        if (p.tipo === "insumo") await moverInsumo(tx, { ...base, insumoId: p.id, motivo: "traspaso" });
        else await moverExistencia(tx, { ...base, productoId: p.id, motivo: "traspaso" });
      }
    }
    return tr;
  });

  await registrar(sesion, "crear", "traspaso", resultado.id, { nombre: resultado.folio, origen: origen.nombre, destino: destino.nombre });
  return { ok: true, id: resultado.id, folio: resultado.folio };
}
