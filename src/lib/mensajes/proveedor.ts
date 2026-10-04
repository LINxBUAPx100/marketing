import "server-only";

// Envío por la API de WhatsApp Cloud (Meta). Con WHATSAPP_TOKEN y WHATSAPP_PHONE_ID se manda de verdad
// desde el número del negocio; sin ellos se simula: el mensaje queda en la bitácora como "simulado"
// y en pantalla se sigue ofreciendo el enlace wa.me para mandarlo a mano.

export type Envio = { estado: "enviado" | "fallido" | "simulado"; wamid: string | null; error: string | null };

const VERSION_API = "v23.0";

export function whatsappConfigurado() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

export async function enviarPlantilla(telefono: string, plantilla: string, variables: string[]): Promise<Envio> {
  const token = process.env.WHATSAPP_TOKEN;
  const telefonoId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !telefonoId) return { estado: "simulado", wamid: null, error: null };

  try {
    const r = await fetch(`https://graph.facebook.com/${VERSION_API}/${telefonoId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefono,
        type: "template",
        template: {
          name: plantilla,
          language: { code: process.env.WHATSAPP_IDIOMA || "es_MX" },
          components: [{ type: "body", parameters: variables.map((text) => ({ type: "text", text })) }],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const cuerpo = (await r.json().catch(() => null)) as { messages?: { id: string }[]; error?: { message?: string; error_data?: { details?: string } } } | null;
    if (!r.ok) return { estado: "fallido", wamid: null, error: cuerpo?.error?.error_data?.details ?? cuerpo?.error?.message ?? `Meta respondió ${r.status}.` };
    return { estado: "enviado", wamid: cuerpo?.messages?.[0]?.id ?? null, error: null };
  } catch (e) {
    return { estado: "fallido", wamid: null, error: e instanceof Error ? e.message : "No se pudo conectar con WhatsApp." };
  }
}
