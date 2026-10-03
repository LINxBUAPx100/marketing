// Fase 1: enlaces wa.me que abren WhatsApp con el mensaje escrito. La API de Meta llega en la fase 7.

/** Normaliza un teléfono mexicano a 52 + 10 dígitos. Null si no alcanza. */
export function telefonoWhatsApp(telefono: string | null | undefined) {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (digitos.length === 10) return `52${digitos}`;
  if (digitos.length === 12 && digitos.startsWith("52")) return digitos;
  if (digitos.length === 13 && digitos.startsWith("521")) return `52${digitos.slice(3)}`;
  return null;
}

export function enlaceWhatsApp(telefono: string | null | undefined, mensaje: string) {
  const numero = telefonoWhatsApp(telefono);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : null;
}
