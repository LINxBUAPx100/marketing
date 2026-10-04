import { and, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Buscador } from "@/components/buscador";
import { Encabezado } from "@/components/encabezado";
import { EstadoCotizacion } from "@/components/estado-cotizacion";
import { FiltroSelect } from "@/components/filtro-select";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoFecha, formatoMoneda } from "@/lib/numeros";

export const metadata: Metadata = { title: "Cotizaciones" };

export default async function PaginaCotizaciones({ searchParams }: PageProps<"/cotizaciones">) {
  const sesion = await requerirPermiso("cotizaciones.ver");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const misSucursales = sesion.sucursales.map((s) => s.id);
  if (!misSucursales.length) return <Encabezado titulo="Cotizaciones" descripcion="No tienes sucursales asignadas." />;
  const ahora = new Date();

  const filtros = [eq(t.cotizacion.negocioId, sesion.negocio.id), inArray(t.cotizacion.sucursalId, misSucursales)];
  if (sp.q?.trim()) {
    const patron = `%${sp.q.trim()}%`;
    filtros.push(or(ilike(t.cotizacion.folio, patron), ilike(t.cliente.nombre, patron), ilike(t.cliente.empresa, patron))!);
  }
  const estado = sp.estado ?? "abiertas";
  if (estado === "abiertas") filtros.push(eq(t.cotizacion.estado, "abierta"), gte(t.cotizacion.vigenciaHasta, ahora));
  else if (estado === "vencidas") filtros.push(eq(t.cotizacion.estado, "abierta"), lt(t.cotizacion.vigenciaHasta, ahora));
  else if (estado === "aceptadas") filtros.push(eq(t.cotizacion.estado, "aceptada"));
  else if (estado === "rechazadas") filtros.push(inArray(t.cotizacion.estado, ["rechazada", "cancelada"]));

  // Próximo seguimiento pendiente de cada cotización.
  const proximo = db
    .select({ cotizacionId: t.seguimiento.cotizacionId, fecha: sql<Date>`min(${t.seguimiento.fecha})`.as("fecha") })
    .from(t.seguimiento)
    .where(isNull(t.seguimiento.hechoEn))
    .groupBy(t.seguimiento.cotizacionId)
    .as("proximo");

  const [cotizaciones, [resumen]] = await Promise.all([
    db
      .select({
        id: t.cotizacion.id,
        folio: t.cotizacion.folio,
        creadoEn: t.cotizacion.creadoEn,
        vigenciaHasta: t.cotizacion.vigenciaHasta,
        estado: t.cotizacion.estado,
        total: t.cotizacion.total,
        cliente: t.cliente.nombre,
        vendedor: t.usuario.nombre,
        seguimiento: proximo.fecha,
      })
      .from(t.cotizacion)
      .innerJoin(t.cliente, eq(t.cliente.id, t.cotizacion.clienteId))
      .innerJoin(t.usuario, eq(t.usuario.id, t.cotizacion.usuarioId))
      .leftJoin(proximo, eq(proximo.cotizacionId, t.cotizacion.id))
      .where(and(...filtros))
      .orderBy(desc(t.cotizacion.creadoEn))
      .limit(300),
    // Conversión de los últimos 90 días: cuántas cotizaciones terminaron en venta.
    db
      .select({
        total: sql<number>`count(*)::int`,
        vendidas: sql<number>`count(*) filter (where ${t.cotizacion.estado} = 'aceptada')::int`,
        abiertoMonto: sql<number>`coalesce(sum(${t.cotizacion.total}) filter (where ${t.cotizacion.estado} = 'abierta' and ${t.cotizacion.vigenciaHasta} >= ${ahora}), 0)::int`,
      })
      .from(t.cotizacion)
      .where(and(eq(t.cotizacion.negocioId, sesion.negocio.id), inArray(t.cotizacion.sucursalId, misSucursales), gte(t.cotizacion.creadoEn, new Date(ahora.getTime() - 90 * 86_400_000)))),
  ]);
  const conversion = resumen.total ? Math.round((resumen.vendidas / resumen.total) * 100) : null;

  return (
    <>
      <Encabezado titulo="Cotizaciones" descripcion="Envía cotizaciones, agenda seguimientos y conviértelas en venta.">
        {sesion.puede("cotizaciones.crear") && (
          <Button nativeButton={false} render={<Link href="/cotizaciones/nueva" />}>
            <Plus /> Nueva cotización
          </Button>
        )}
      </Encabezado>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Por cerrar (vigentes)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoMoneda(resumen.abiertoMonto)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Se convierten en venta (90 días)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{conversion == null ? "—" : `${conversion} %`}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Buscador placeholder="Buscar por folio o cliente" valor={sp.q}>
        <FiltroSelect nombre="estado" valor={estado} etiqueta="Estado">
          <option value="abiertas">Abiertas</option>
          <option value="vencidas">Vencidas</option>
          <option value="aceptadas">Vendidas</option>
          <option value="rechazadas">Rechazadas o canceladas</option>
          <option value="todas">Todas</option>
        </FiltroSelect>
      </Buscador>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Vigencia</TableHead>
              <TableHead className="hidden lg:table-cell">Seguimiento</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cotizaciones.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-12 text-center">
                  No hay cotizaciones con estos filtros.
                </TableCell>
              </TableRow>
            )}
            {cotizaciones.map((c) => {
              const seguimientoVencido = c.seguimiento && new Date(c.seguimiento) <= ahora;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/cotizaciones/${c.id}`} className="font-mono text-sm font-medium hover:underline">
                      {c.folio}
                    </Link>
                    <span className="text-muted-foreground block text-xs">{c.vendedor}</span>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{c.cliente}</TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">{formatoFecha(c.vigenciaHasta)}</TableCell>
                  <TableCell className={`hidden lg:table-cell ${seguimientoVencido ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {c.seguimiento ? formatoFecha(c.seguimiento) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(c.total)}</TableCell>
                  <TableCell>
                    <EstadoCotizacion cotizacion={c} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
