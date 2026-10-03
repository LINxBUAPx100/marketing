import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import type { ResumenCaja } from "@/lib/caja/resumen";
import { formatoFechaHora, formatoMoneda } from "@/lib/numeros";

export const metadata: Metadata = { title: "Cortes de caja" };

export default async function PaginaCortes() {
  const sesion = await requerirPermiso("caja.ver");
  const sucursales = sesion.puede("caja.todas") ? sesion.sucursales.map((s) => s.id) : sesion.sucursal ? [sesion.sucursal.id] : [];
  const cortes = sucursales.length
    ? await db
        .select({
          id: t.corteCaja.id,
          creadoEn: t.corteCaja.creadoEn,
          resumen: t.corteCaja.resumen,
          efectivoEsperado: t.corteCaja.efectivoEsperado,
          efectivoContado: t.corteCaja.efectivoContado,
          sucursal: t.sucursal.nombre,
          usuario: t.usuario.nombre,
        })
        .from(t.corteCaja)
        .innerJoin(t.sucursal, eq(t.sucursal.id, t.corteCaja.sucursalId))
        .innerJoin(t.usuario, eq(t.usuario.id, t.corteCaja.usuarioId))
        .where(and(eq(t.corteCaja.negocioId, sesion.negocio.id), inArray(t.corteCaja.sucursalId, sucursales)))
        .orderBy(desc(t.corteCaja.creadoEn))
        .limit(200)
    : [];

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/caja" />}>
        <ArrowLeft /> Caja
      </Button>
      <Encabezado titulo="Cortes de caja" descripcion="Historial de cortes con sus diferencias." />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="hidden sm:table-cell">Sucursal</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="hidden text-right md:table-cell">Gastos</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cortes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-12 text-center">
                  Aún no se ha hecho ningún corte.
                </TableCell>
              </TableRow>
            )}
            {cortes.map((c) => {
              const r = c.resumen as ResumenCaja;
              const diferencia = c.efectivoContado - c.efectivoEsperado;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/caja/cortes/${c.id}`} className="font-medium hover:underline">
                      {formatoFechaHora(c.creadoEn)}
                    </Link>
                    <span className="text-muted-foreground block text-xs">{c.usuario}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">{c.sucursal}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(r.totalCobros)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{formatoMoneda(r.totalEgresos)}</TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${diferencia === 0 ? "text-emerald-700" : "text-destructive"}`}>
                    {diferencia === 0 ? "Cuadra" : `${diferencia > 0 ? "+" : "−"}${formatoMoneda(Math.abs(diferencia))}`}
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
