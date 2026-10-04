"use client";

import { MessageCircle } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { mandarWhatsApp } from "@/app/(app)/configuracion/whatsapp/acciones";
import { Button } from "@/components/ui/button";
import type { ClavePlantilla } from "@/lib/mensajes/plantillas";

type Props = {
  /** Con la API de WhatsApp configurada se manda la plantilla desde el número del negocio. */
  api: boolean;
  clave: ClavePlantilla;
  entidadId: string;
  /** Sin API: enlace wa.me para mandarlo a mano desde el WhatsApp de la computadora o el celular. */
  enlace: string | null;
  etiqueta?: string;
  variant?: "default" | "outline";
};

export function BotonWhatsApp({ api, clave, entidadId, enlace, etiqueta = "WhatsApp", variant = "outline" }: Props) {
  const [enviando, iniciar] = useTransition();

  if (!api) {
    if (!enlace) return null;
    return (
      <Button variant={variant} nativeButton={false} render={<a href={enlace} target="_blank" rel="noopener noreferrer" />}>
        <MessageCircle /> {etiqueta}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      disabled={enviando}
      onClick={() =>
        iniciar(async () => {
          const r = await mandarWhatsApp(clave, entidadId);
          if (!r.ok || r.estado === "fallido") toast.error(r.mensaje);
          else toast.success(r.mensaje);
        })
      }
    >
      <MessageCircle /> {enviando ? "Enviando…" : etiqueta}
    </Button>
  );
}
