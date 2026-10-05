// Plantillas de WhatsApp. Meta solo deja iniciar conversación con plantillas aprobadas:
// hay que darlas de alta en el administrador de WhatsApp con el mismo nombre, idioma
// español (MEX) y el texto de abajo, donde {{1}}, {{2}}… son las variables en ese orden.

export type ClavePlantilla = "venta_registrada" | "pedido_listo" | "cotizacion_enviada" | "factura_emitida" | "recordatorio_saldo";

export type Plantilla = {
  clave: ClavePlantilla;
  nombre: string;
  descripcion: string;
  /** Se puede mandar sola al ocurrir el evento. */
  automatica: boolean;
  variables: string[];
  cuerpo: string;
};

export const PLANTILLAS: Plantilla[] = [
  {
    clave: "venta_registrada",
    nombre: "Pedido registrado",
    descripcion: "Al registrar una venta a un cliente con teléfono.",
    automatica: true,
    variables: ["Nombre", "Folio", "Negocio", "Total", "Saldo", "Entrega"],
    cuerpo: "Hola {{1}}, registramos tu pedido {{2}} en {{3}} por {{4}}. Saldo pendiente: {{5}}. Entrega: {{6}}. ¡Gracias por tu preferencia!",
  },
  {
    clave: "pedido_listo",
    nombre: "Pedido listo",
    descripcion: "Cuando la orden de producción pasa a la etapa de listo.",
    automatica: true,
    variables: ["Nombre", "Folio", "Sucursal", "Saldo"],
    cuerpo: "Hola {{1}}, tu pedido {{2}} ya está listo para recoger en {{3}}. Saldo pendiente: {{4}}. ¡Te esperamos!",
  },
  {
    clave: "factura_emitida",
    nombre: "Factura emitida",
    descripcion: "Al timbrar una factura de ingreso para un cliente.",
    automatica: true,
    variables: ["Nombre", "Folio", "Negocio", "Total", "Folio fiscal"],
    cuerpo: "Hola {{1}}, emitimos tu factura {{2}} de {{3}} por {{4}}. Folio fiscal: {{5}}.",
  },
  {
    clave: "cotizacion_enviada",
    nombre: "Cotización",
    descripcion: "Se manda desde la cotización.",
    automatica: false,
    variables: ["Nombre", "Folio", "Negocio", "Total", "Vigencia"],
    cuerpo: "Hola {{1}}, te compartimos la cotización {{2}} de {{3}} por {{4}} (IVA incluido), válida hasta el {{5}}. Respóndenos para confirmarla.",
  },
  {
    clave: "recordatorio_saldo",
    nombre: "Recordatorio de saldo",
    descripcion: "Se manda desde el cliente o desde cuentas por cobrar.",
    automatica: false,
    variables: ["Nombre", "Saldo", "Negocio"],
    cuerpo: "Hola {{1}}, te recordamos que tienes un saldo pendiente de {{2}} con {{3}}. Si ya pagaste, ignora este mensaje. ¡Gracias!",
  },
];

export const CLAVES_PLANTILLAS = PLANTILLAS.map((p) => p.clave) as [ClavePlantilla, ...ClavePlantilla[]];

export const plantilla = (clave: ClavePlantilla) => PLANTILLAS.find((p) => p.clave === clave)!;

/** Texto final del mensaje con las variables sustituidas. Meta rechaza variables vacías, por eso van con "-". */
export function textoPlantilla(clave: ClavePlantilla, variables: string[]) {
  return plantilla(clave).cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n: string) => limpiarVariable(variables[Number(n) - 1]));
}

/** Meta no acepta saltos de línea, tabuladores ni más de 4 espacios seguidos dentro de una variable. */
export function limpiarVariable(v: string | null | undefined) {
  const limpio = (v ?? "").replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
  return limpio || "-";
}
