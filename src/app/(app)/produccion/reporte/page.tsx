import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { FiltroSelect } from "@/components/filtro-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { haceDias } from "@/lib/fechas";
import { eventosDesde } from "@/lib/produccion/consultas";
import { formatoDuracion, tiemposPorEtapa } from "@/lib/produccion/reglas";
import { etapasDe } from "@/lib/produccion/servidor";

export const metadata: Metadata = { title: "Tiempos de producción" };

const DIAS = [7, 30, 90] as const;

export default async function PaginaReporte({ searchParams }: PageProps<"/produccion/reporte">) {
  const sesion = await requerirPermiso("produccion.ver");
  const { dias: diasParam } = (await searchParams) as Record<string, string | undefined>;
  const dias = DIAS.find((d) => String(d) === diasParam) ?? 30;
  const desde = haceDias(dias);
  const negocioId = sesion.negocio.id;

  const [etapas, eventos, [entregas]] = await Promise.all([
    etapasDe(negocioId),
    eventosDesde(negocioId, desde),
    db
      .select({
        total: sql<number>`count(*)::int`,
        aTiempo: sql<number>`count(*) filter (where ${t.ordenProduccion.entregadaEn} <= ${t.ordenProduccion.fechaCompromiso})::int`,
      })
      .from(t.ordenProduccion)
      .where(and(eq(t.ordenProduccion.negocioId, negocioId), eq(t.ordenProduccion.estado, "entregada"), isNotNull(t.ordenProduccion.fechaCompromiso), gte(t.ordenProduccion.entregadaEn, desde))),
  ]);

  // Solo etapas de trabajo: "listo" mide espera del cliente y "entregado" ya no corre.
  const tiempos = tiemposPorEtapa(eventos);
  const filas = etapas
    .filter((e) => e.tipo !== "entregado")
    .map((e) => ({ etapa: e, ...(tiempos.get(e.id) ?? { promedioHoras: 0, ordenes: 0 }) }));
  const maximo = Math.max(1, ...filas.filter((f) => f.etapa.tipo === "proceso").map((f) => f.promedioHoras));
  const cuello = filas.filter((f) => f.etapa.tipo === "proceso" && f.ordenes > 0).sort((a, b) => b.promedioHoras - a.promedioHoras)[0];
  const porcentaje = entregas.total ? Math.round((entregas.aTiempo / entregas.total) * 100) : null;

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/produccion" />}>
        <ArrowLeft /> Producción
      </Button>
      <Encabezado titulo="Tiempos de producción" descripcion={`Órdenes creadas en los últimos ${dias} días.`}>
        <form>
          <FiltroSelect nombre="dias" valor={String(dias)} etiqueta="Periodo">
            {DIAS.map((d) => (
              <option key={d} value={d}>
                Últimos {d} días
              </option>
            ))}
          </FiltroSelect>
        </form>
      </Encabezado>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Entregas a tiempo</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{porcentaje == null ? "—" : `${porcentaje} %`}</CardTitle>
            <CardDescription>
              {entregas.aTiempo} de {entregas.total} con fecha compromiso
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Etapa más lenta</CardDescription>
            <CardTitle className="text-2xl">{cuello?.etapa.nombre ?? "—"}</CardTitle>
            {cuello && <CardDescription>{formatoDuracion(cuello.promedioHoras)} en promedio por orden</CardDescription>}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Órdenes medidas</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{new Set(eventos.map((e) => e.ordenId)).size}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tiempo promedio en cada etapa</CardTitle>
          <CardDescription>Desde que la orden llega a la etapa hasta que pasa a la siguiente. Las que siguen en curso cuentan hasta ahora.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {filas.map((f) => (
            <div key={f.etapa.id} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-3 text-sm max-sm:grid-cols-[1fr_5rem]">
              <span className="truncate font-medium">{f.etapa.nombre}</span>
              <div className="bg-muted h-3 overflow-hidden rounded-full max-sm:col-span-2 max-sm:row-start-2">
                {f.etapa.tipo === "proceso" && (
                  <div
                    className={`h-full rounded-full ${f === cuello ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${(f.promedioHoras / maximo) * 100}%` }}
                  />
                )}
              </div>
              <span className="text-right tabular-nums">
                {f.ordenes ? formatoDuracion(f.promedioHoras) : "—"}
                <span className="text-muted-foreground block text-xs">{f.etapa.tipo === "listo" ? "esperando al cliente" : `${f.ordenes} órdenes`}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
