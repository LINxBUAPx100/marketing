import { Badge } from "@/components/ui/badge";
import { estadoCotizacion } from "@/lib/produccion/reglas";

const ESTILO = {
  abierta: { texto: "Abierta", variante: "secondary" },
  vencida: { texto: "Vencida", variante: "outline" },
  aceptada: { texto: "Vendida", variante: "default" },
  rechazada: { texto: "Rechazada", variante: "destructive" },
  cancelada: { texto: "Cancelada", variante: "outline" },
} as const;

export function EstadoCotizacion({ cotizacion }: { cotizacion: Parameters<typeof estadoCotizacion>[0] }) {
  const e = ESTILO[estadoCotizacion(cotizacion)];
  return <Badge variant={e.variante}>{e.texto}</Badge>;
}
