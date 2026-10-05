import { and, desc, eq, isNotNull } from "drizzle-orm";
import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { ETIQUETA_METODO, METODOS } from "@/lib/caja/resumen";
import { periodoActual } from "@/lib/caja/servidor";
import { formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { DialogoCorte, DialogoMovimiento } from "./dialogos";

export const metadata: Metadata = { title: "Caja" };

const TIPO_MOVIMIENTO = { ingreso: "Ingreso", egreso: "Gasto", fondo: "Fondo" } as const;

export default async function PaginaCaja() {
  const sesion = await requerirPermiso("caja.ver");
  const sucursal = sesion.sucursal;
  if (!sucursal) return <Encabezado titulo="Caja" descripcion="No tienes una sucursal asignada." />;

  const verTodas = sesion.puede("caja.todas") && sesion.sucursales.length > 1;
  const [periodo, otras, categoriasUsadas] = await Promise.all([
    periodoActual(sucursal.id),
    verTodas
      ? Promise.all(sesion.sucursales.map(async (s) => ({ sucursal: s, resumen: (await periodoActual(s.id)).resumen })))
      : Promise.resolve([]),
    db
      .selectDistinct({ categoria: t.movimientoCaja.categoria })
      .from(t.movimientoCaja)
      .where(and(eq(t.movimientoCaja.negocioId, sesion.negocio.id), eq(t.movimientoCaja.tipo, "egreso"), isNotNull(t.movimientoCaja.categoria)))
      .orderBy(desc(t.movimientoCaja.categoria))
      .limit(30),
  ]);
  const { resumen, pagos, movimientos } = periodo;
  const inicio = [...pagos.map((p) => p.creadoEn), ...movimientos.map((m) => m.creadoEn)].sort((a, b) => +a - +b)[0];

  return (
    <>
      <Encabezado
        titulo={`Caja · ${sucursal.nombre}`}
        descripcion={inicio ? `Periodo abierto desde: ${formatoFechaHora(inicio)}` : "Sin movimientos desde el último corte."}
      >
        <Button variant="ghost" nativeButton={false} render={<Link href="/caja/cortes" />}>
          <History /> Cortes anteriores
        </Button>
        {sesion.puede("caja.movimientos") && (
          <>
            <DialogoMovimiento tipo="fondo" categoriasUsadas={[]} />
            <DialogoMovimiento tipo="ingreso" categoriasUsadas={[]} />
            <DialogoMovimiento tipo="egreso" categoriasUsadas={categoriasUsadas.map((c) => c.categoria)} />
          </>
        )}
        {sesion.puede("caja.corte") && <DialogoCorte esperado={resumen.efectivoEsperado} />}
      </Encabezado>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="ring-primary/30 ring-2">
          <CardHeader>
            <CardDescription>Efectivo que debe haber</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoMoneda(resumen.efectivoEsperado)}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground grid gap-0.5 text-xs tabular-nums">
            <span>Fondo {formatoMoneda(resumen.fondo)}</span>
            <span>+ Cobros en efectivo {formatoMoneda(resumen.cobrosPorMetodo.efectivo)}</span>
            <span>+ Ingresos {formatoMoneda(resumen.ingresosPorMetodo.efectivo)}</span>
            <span>− Gastos {formatoMoneda(resumen.egresosPorMetodo.efectivo)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cobrado en el periodo</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoMoneda(resumen.totalCobros)}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground grid gap-0.5 text-xs tabular-nums">
            {METODOS.filter((m) => resumen.cobrosPorMetodo[m]).map((m) => (
              <span key={m}>
                {ETIQUETA_METODO[m]} {formatoMoneda(resumen.cobrosPorMetodo[m])}
              </span>
            ))}
            {!resumen.totalCobros && <span>Sin cobros todavía.</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Gastos</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoMoneda(resumen.totalEgresos)}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground grid gap-0.5 text-xs tabular-nums">
            {Object.entries(resumen.egresosPorCategoria).map(([c, v]) => (
              <span key={c}>
                {c} {formatoMoneda(v)}
              </span>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Otros ingresos</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoMoneda(resumen.totalIngresos)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {verTodas && (
        <Card className="mt-6 py-0">
          <CardHeader className="pt-4">
            <CardTitle>Todas las sucursales</CardTitle>
            <CardDescription>Periodo abierto de cada caja.</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sucursal</TableHead>
                <TableHead className="text-right">Cobrado</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Efectivo esperado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {otras.map(({ sucursal: s, resumen: r }) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.nombre} {s.id === sucursal.id && <Badge variant="secondary">Actual</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(r.totalCobros)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(r.totalEgresos)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(r.efectivoEsperado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 py-0">
          <CardHeader className="pt-4">
            <CardTitle>Cobros</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Venta</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    Los cobros de ventas y abonos aparecerán aquí.
                  </TableCell>
                </TableRow>
              )}
              {pagos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatoFechaHora(p.creadoEn)}</TableCell>
                  <TableCell>
                    <Link href={`/ventas/${p.ventaId}`} className="font-mono text-sm hover:underline">
                      {p.folio}
                    </Link>
                    <span className="text-muted-foreground block text-xs">{p.usuario}</span>
                  </TableCell>
                  <TableCell>{ETIQUETA_METODO[p.metodo]}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(p.monto)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="min-w-0 py-0">
          <CardHeader className="pt-4">
            <CardTitle>Ingresos, gastos y fondo</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground py-8 text-center">
                    Sin ingresos ni gastos en este periodo.
                  </TableCell>
                </TableRow>
              )}
              {movimientos.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatoFechaHora(m.creadoEn)}</TableCell>
                  <TableCell className="whitespace-normal">
                    <Badge variant={m.tipo === "egreso" ? "destructive" : "secondary"}>{TIPO_MOVIMIENTO[m.tipo]}</Badge> {m.concepto}
                    <span className="text-muted-foreground block text-xs">
                      {m.categoria} · {ETIQUETA_METODO[m.metodo]} · {m.usuario}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${m.tipo === "egreso" ? "text-destructive" : ""}`}>
                    {m.tipo === "egreso" ? "−" : ""}
                    {formatoMoneda(m.monto)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
