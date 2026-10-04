import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { obtenerSesion } from "@/lib/auth";
import { formatoFechaHora, formatoMoneda, formatoPorcentaje } from "@/lib/numeros";

export const metadata: Metadata = { title: "Comisiones" };

export default async function PaginaComisionesUsuario({ params }: PageProps<"/comisiones/[usuarioId]">) {
  const { usuarioId } = await params;
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  // Cada quien puede ver sus propias comisiones; las de otros requieren permiso.
  if (usuarioId !== sesion.usuario.id && !sesion.puede("comisiones.ver")) redirect("/sin-permiso");
  if (!/^[0-9a-f-]{36}$/i.test(usuarioId)) notFound();
  const [vendedor] = await db.select().from(t.usuario).where(and(eq(t.usuario.id, usuarioId), eq(t.usuario.negocioId, sesion.negocio.id)));
  if (!vendedor) notFound();

  const [comisiones, pagos] = await Promise.all([
    db
      .select({ comision: t.comision, folio: t.venta.folio, ventaId: t.venta.id, total: t.venta.total, pagado: t.venta.pagado, estadoVenta: t.venta.estado, cliente: t.cliente.nombre })
      .from(t.comision)
      .innerJoin(t.venta, eq(t.venta.id, t.comision.ventaId))
      .leftJoin(t.cliente, eq(t.cliente.id, t.venta.clienteId))
      .where(eq(t.comision.usuarioId, usuarioId))
      .orderBy(desc(t.comision.creadoEn))
      .limit(200),
    db.select().from(t.pagoComision).where(eq(t.pagoComision.usuarioId, usuarioId)).orderBy(desc(t.pagoComision.creadoEn)).limit(30),
  ]);

  // Una venta puede tener varias partidas: se agrupan por venta.
  const porVenta = new Map<string, { folio: string; ventaId: string; cliente: string | null; fecha: Date; base: number; monto: number; estado: string; cobrada: boolean }>();
  for (const c of comisiones) {
    const v = porVenta.get(c.ventaId) ?? {
      folio: c.folio,
      ventaId: c.ventaId,
      cliente: c.cliente,
      fecha: c.comision.creadoEn,
      base: 0,
      monto: 0,
      estado: c.comision.estado,
      cobrada: c.estadoVenta === "activa" && c.pagado >= c.total,
    };
    v.base += c.comision.base;
    v.monto += c.comision.monto;
    porVenta.set(c.ventaId, v);
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/comisiones" />}>
        <ArrowLeft /> Comisiones
      </Button>
      <Encabezado titulo={`Comisiones de ${vendedor.nombre}`} descripcion={vendedor.comisionBp ? `Comisión base ${formatoPorcentaje(vendedor.comisionBp)}.` : "Sin comisión base."} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venta</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Base sin IVA</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porVenta.size === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                    Sin comisiones todavía.
                  </TableCell>
                </TableRow>
              )}
              {[...porVenta.values()].map((v) => (
                <TableRow key={v.ventaId} className={v.estado === "cancelada" ? "opacity-55" : undefined}>
                  <TableCell>
                    <Link href={`/ventas/${v.ventaId}`} className="font-mono text-sm font-medium hover:underline">
                      {v.folio}
                    </Link>
                    <span className="text-muted-foreground block text-xs">
                      {formatoFechaHora(v.fecha)} · {v.cliente ?? "Público en general"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">{formatoMoneda(v.base)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(v.monto)}</TableCell>
                  <TableCell>
                    {v.estado === "pagada" ? (
                      <Badge variant="secondary">Pagada</Badge>
                    ) : v.estado === "cancelada" ? (
                      <Badge variant="outline">Venta cancelada</Badge>
                    ) : v.cobrada ? (
                      <Badge>Por pagar</Badge>
                    ) : (
                      <Badge variant="outline">Esperando cobro</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card className="content-start">
          <CardHeader>
            <CardTitle>Pagos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {pagos.length === 0 && <p className="text-muted-foreground">Sin pagos.</p>}
            {pagos.map((p) => (
              <div key={p.id} className="flex justify-between gap-2">
                <span>
                  {formatoFechaHora(p.creadoEn)}
                  <span className="text-muted-foreground block text-xs">{[p.movimientoCajaId ? "de caja" : null, p.notas].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="font-medium tabular-nums">{formatoMoneda(p.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
