import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { usuariosActivos } from "@/lib/produccion/consultas";
import { etapasDe } from "@/lib/produccion/servidor";
import { BotonesOrden, DialogoEtapa } from "./controles";

export const metadata: Metadata = { title: "Etapas de producción" };

const TIPO = { proceso: "Proceso", listo: "Listo (avisa al cliente)", entregado: "Entregado (cierra la orden)" } as const;

export default async function PaginaEtapas() {
  const sesion = await requerirPermiso("produccion.etapas");
  await etapasDe(sesion.negocio.id); // crea las de omisión si no hay
  const [etapas, usuarios] = await Promise.all([
    db.select().from(t.etapaProduccion).where(eq(t.etapaProduccion.negocioId, sesion.negocio.id)).orderBy(asc(t.etapaProduccion.orden)),
    usuariosActivos(sesion.negocio.id),
  ]);
  const nombreUsuario = new Map(usuarios.map((u) => [u.id, u.nombre]));

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/produccion" />}>
        <ArrowLeft /> Producción
      </Button>
      <Encabezado titulo="Etapas de producción" descripcion="Las columnas del tablero, en orden. Cada etapa puede tener un responsable que la toma por omisión.">
        <DialogoEtapa usuarios={usuarios} />
      </Encabezado>
      <Card className="divide-y py-0">
        {etapas.map((e, i) => (
          <div key={e.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${e.activa ? "" : "opacity-55"}`}>
            <BotonesOrden id={e.id} primera={i === 0} ultima={i === etapas.length - 1} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {e.nombre} {!e.activa && <Badge variant="outline">Inactiva</Badge>}
              </p>
              <p className="text-muted-foreground text-sm">
                {TIPO[e.tipo]} · {e.responsableId ? `Responsable: ${nombreUsuario.get(e.responsableId) ?? "—"}` : "Sin responsable fijo"}
              </p>
            </div>
            <DialogoEtapa usuarios={usuarios} etapa={{ id: e.id, nombre: e.nombre, tipo: e.tipo, responsableId: e.responsableId ?? "", activa: e.activa }} />
          </div>
        ))}
      </Card>
    </>
  );
}
