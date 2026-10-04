import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { telefonoWhatsApp } from "@/lib/whatsapp";
import { type ClavePlantilla, limpiarVariable, textoPlantilla } from "./plantillas";
import { enviarPlantilla } from "./proveedor";

type Resultado = { ok: true; estado: "enviado" | "fallido" | "simulado"; mensaje: string } | { ok: false; mensaje: string };

const ENTIDAD: Record<ClavePlantilla, string> = {
  venta_registrada: "venta",
  pedido_listo: "venta",
  factura_emitida: "factura",
  cotizacion_enviada: "cotizacion",
  recordatorio_saldo: "cliente",
};

type Datos = { clienteId: string; nombre: string; telefono: string | null; variables: string[] };

/** Junta el destinatario y las variables de la plantilla a partir del registro. */
async function datosDelAviso(negocioId: string, clave: ClavePlantilla, entidadId: string): Promise<Datos | string> {
  const [negocio] = await db.select({ nombre: t.negocio.nombre }).from(t.negocio).where(eq(t.negocio.id, negocioId));

  if (clave === "venta_registrada" || clave === "pedido_listo") {
    const [f] = await db
      .select({ venta: t.venta, cliente: t.cliente, sucursal: t.sucursal.nombre })
      .from(t.venta)
      .innerJoin(t.sucursal, eq(t.sucursal.id, t.venta.sucursalId))
      .leftJoin(t.cliente, eq(t.cliente.id, t.venta.clienteId))
      .where(and(eq(t.venta.id, entidadId), eq(t.venta.negocioId, negocioId)));
    if (!f) return "La venta ya no existe.";
    if (!f.cliente) return "La venta es de público en general: no hay a quién mandarle el mensaje.";
    if (f.venta.estado !== "activa") return "La venta está cancelada.";
    const saldo = formatoMoneda(f.venta.total - f.venta.pagado);
    const base = { clienteId: f.cliente.id, nombre: f.cliente.nombre, telefono: f.cliente.telefono };
    return clave === "venta_registrada"
      ? {
          ...base,
          variables: [
            f.cliente.nombre,
            f.venta.folio,
            negocio.nombre,
            formatoMoneda(f.venta.total),
            saldo,
            f.venta.fechaEntrega ? formatoFechaHora(f.venta.fechaEntrega) : "por confirmar",
          ],
        }
      : { ...base, variables: [f.cliente.nombre, f.venta.folio, `${negocio.nombre} (${f.sucursal})`, saldo] };
  }

  if (clave === "factura_emitida") {
    const [f] = await db
      .select({ factura: t.factura, cliente: t.cliente })
      .from(t.factura)
      .leftJoin(t.cliente, eq(t.cliente.id, t.factura.clienteId))
      .where(and(eq(t.factura.id, entidadId), eq(t.factura.negocioId, negocioId)));
    if (!f) return "La factura ya no existe.";
    if (!f.cliente) return "La factura no es de un cliente registrado.";
    if (f.factura.estado !== "vigente") return "La factura está cancelada.";
    return {
      clienteId: f.cliente.id,
      nombre: f.cliente.nombre,
      telefono: f.cliente.telefono,
      variables: [f.cliente.nombre, `${f.factura.serie}-${f.factura.folio}`, negocio.nombre, formatoMoneda(f.factura.total), f.factura.uuid ?? "-"],
    };
  }

  if (clave === "cotizacion_enviada") {
    const [f] = await db
      .select({ cotizacion: t.cotizacion, cliente: t.cliente })
      .from(t.cotizacion)
      .innerJoin(t.cliente, eq(t.cliente.id, t.cotizacion.clienteId))
      .where(and(eq(t.cotizacion.id, entidadId), eq(t.cotizacion.negocioId, negocioId)));
    if (!f) return "La cotización ya no existe.";
    return {
      clienteId: f.cliente.id,
      nombre: f.cliente.nombre,
      telefono: f.cliente.telefono,
      variables: [f.cliente.nombre, f.cotizacion.folio, negocio.nombre, formatoMoneda(f.cotizacion.total), formatoFecha(f.cotizacion.vigenciaHasta)],
    };
  }

  // recordatorio_saldo
  const [c] = await db
    .select({
      cliente: t.cliente,
      saldo: sql<number>`coalesce((select sum(v.total - v.pagado) from ${t.venta} v where v.cliente_id = ${t.cliente.id} and v.estado = 'activa'), 0)::int`,
    })
    .from(t.cliente)
    .where(and(eq(t.cliente.id, entidadId), eq(t.cliente.negocioId, negocioId)));
  if (!c) return "El cliente ya no existe.";
  if (c.saldo <= 0) return "El cliente no tiene saldo pendiente.";
  return { clienteId: c.cliente.id, nombre: c.cliente.nombre, telefono: c.cliente.telefono, variables: [c.cliente.nombre, formatoMoneda(c.saldo), negocio.nombre] };
}

/**
 * Manda una plantilla de WhatsApp y la deja en la bitácora de mensajes.
 * Los automáticos solo salen si el negocio los activó y una sola vez por registro.
 */
export async function enviarAviso(d: { negocioId: string; clave: ClavePlantilla; entidadId: string; usuarioId: string | null; automatico: boolean }): Promise<Resultado> {
  const entidad = ENTIDAD[d.clave];
  if (d.automatico) {
    const [negocio] = await db.select({ avisos: t.negocio.avisosWhatsapp }).from(t.negocio).where(eq(t.negocio.id, d.negocioId));
    if (!negocio?.avisos.includes(d.clave)) return { ok: false, mensaje: "Aviso automático desactivado." };
    const [previo] = await db
      .select({ id: t.mensajeWhatsapp.id })
      .from(t.mensajeWhatsapp)
      .where(
        and(
          eq(t.mensajeWhatsapp.entidad, entidad),
          eq(t.mensajeWhatsapp.entidadId, d.entidadId),
          eq(t.mensajeWhatsapp.plantilla, d.clave),
          eq(t.mensajeWhatsapp.automatico, true),
        ),
      )
      .limit(1);
    if (previo) return { ok: false, mensaje: "El aviso ya se había mandado." };
  }

  const datos = await datosDelAviso(d.negocioId, d.clave, d.entidadId);
  if (typeof datos === "string") return { ok: false, mensaje: datos };
  const telefono = telefonoWhatsApp(datos.telefono);
  if (!telefono) return { ok: false, mensaje: `${datos.nombre} no tiene un celular válido de 10 dígitos.` };

  const variables = datos.variables.map(limpiarVariable);
  const envio = await enviarPlantilla(telefono, d.clave, variables);
  await db.insert(t.mensajeWhatsapp).values({
    negocioId: d.negocioId,
    clienteId: datos.clienteId,
    telefono,
    plantilla: d.clave,
    variables,
    texto: textoPlantilla(d.clave, variables),
    estado: envio.estado,
    error: envio.error,
    wamid: envio.wamid,
    entidad,
    entidadId: d.entidadId,
    automatico: d.automatico,
    usuarioId: d.usuarioId,
  });
  const mensaje =
    envio.estado === "enviado"
      ? `Mensaje enviado a ${datos.nombre}.`
      : envio.estado === "simulado"
        ? "WhatsApp no está configurado: el mensaje quedó registrado como simulado."
        : `WhatsApp rechazó el mensaje: ${envio.error}`;
  return { ok: true, estado: envio.estado, mensaje };
}

/** Avisos automáticos: nunca deben tumbar la operación que los dispara. */
export async function avisoAutomatico(negocioId: string, clave: ClavePlantilla, entidadId: string, usuarioId: string | null) {
  try {
    await enviarAviso({ negocioId, clave, entidadId, usuarioId, automatico: true });
  } catch (e) {
    console.error(`Aviso de WhatsApp ${clave} falló`, e);
  }
}

/** Vuelve a mandar un mensaje que falló o que se simuló. */
export async function reintentarMensaje(negocioId: string, mensajeId: string): Promise<Resultado> {
  const [m] = await db
    .select()
    .from(t.mensajeWhatsapp)
    .where(and(eq(t.mensajeWhatsapp.id, mensajeId), eq(t.mensajeWhatsapp.negocioId, negocioId)));
  if (!m) return { ok: false, mensaje: "El mensaje ya no existe." };
  if (m.estado === "enviado") return { ok: false, mensaje: "Ese mensaje ya se envió." };
  const envio = await enviarPlantilla(m.telefono, m.plantilla, m.variables);
  await db.update(t.mensajeWhatsapp).set({ estado: envio.estado, error: envio.error, wamid: envio.wamid }).where(eq(t.mensajeWhatsapp.id, m.id));
  if (envio.estado === "simulado") return { ok: true, estado: envio.estado, mensaje: "WhatsApp sigue sin configurarse." };
  if (envio.estado === "enviado") return { ok: true, estado: envio.estado, mensaje: "Mensaje enviado." };
  return { ok: false, mensaje: `WhatsApp rechazó el mensaje: ${envio.error}` };
}
