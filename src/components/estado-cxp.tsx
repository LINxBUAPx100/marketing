import { Badge } from "@/components/ui/badge";
import { estadoCuentaPorPagar, ETIQUETA_CXP } from "@/lib/almacen/reglas";

const VARIANTE = {
  pagada: "secondary",
  cancelada: "outline",
  vencida: "destructive",
  "por-vencer": "default",
  "al-corriente": "outline",
} as const;

export function EstadoCxP({ compra }: { compra: Parameters<typeof estadoCuentaPorPagar>[0] }) {
  const e = estadoCuentaPorPagar(compra);
  return <Badge variant={VARIANTE[e]}>{ETIQUETA_CXP[e]}</Badge>;
}
