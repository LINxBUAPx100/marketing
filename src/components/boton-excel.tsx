import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Descarga un catálogo en Excel (ver src/lib/reportes/exportar.ts). */
export function BotonExcel({ catalogo, parametros }: { catalogo: string; parametros?: Record<string, string | null | undefined> }) {
  const q = new URLSearchParams(Object.entries(parametros ?? {}).filter((e): e is [string, string] => !!e[1])).toString();
  return (
    <Button variant="outline" nativeButton={false} render={<a href={`/exportar/${catalogo}${q ? `?${q}` : ""}`} download />}>
      <Download /> Excel
    </Button>
  );
}
