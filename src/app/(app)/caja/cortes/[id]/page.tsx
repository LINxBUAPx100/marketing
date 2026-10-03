import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { ETIQUETA_METODO, METODOS, type ResumenCaja } from "@/lib/caja/resumen";
import { formatoFechaHora, formatoMoneda } from "@/lib/numeros";

export const metadata: Metadata = { title: "Corte de caja" };

export default async function PaginaCorte({ params }: PageProps<"/caja/cortes/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("caja.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [corte] = await db
    .select({ corte: t.corteCaja, sucursal: t.sucursal.nombre, usuario: t.usuario.nombre })
    .from(t.corteCaja)
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.corteCaja.sucursalId))
    .innerJoin(t.usuario, eq(t.usuario.id, t.corteCaja.usuarioId))
    .where(and(eq(t.corteCaja.id, id), eq(t.corteCaja.negocioId, sesion.negocio.id)));
  if (!corte || !sesion.sucursales.some((s) => s.id === corte.corte.sucursalId)) notFound();

  const pagos = await db
    .select({ id: t.pago.id, metodo: t.pago.metodo, monto: t.pago.monto, creadoEn: t.pago.creadoEn, folio: t.venta.folio, ventaId: t.venta.id })
    .from(t.pago)
    .innerJoin(t.venta, eq(t.venta.id, t.pago.ventaId))
    .where(and(eq(t.pago.corteId, id), eq(t.pago.cancelado, false)))
    .orderBy(asc(t.pago.creadoEn));

  const c = corte.corte;
  const r = c.resumen as ResumenCaja & { numeroCobros: number };
  const diferencia = c.efectivoContado - c.efectivoEsperado;
  const retirado = c.efectivoContado - c.fondoSiguiente;

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/caja/cortes" />}>
        <ArrowLeft /> Cortes
      </Button>
      <Encabezado titulo={`Corte del ${formatoFechaHora(c.creadoEn)}`} descripcion={`${corte.sucursal} · Lo hizo ${corte.usuario}`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Efectivo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm tabular-nums">
            <Linea etiqueta="Fondo inicial" valor={r.fondo} />
            <Linea etiqueta="Cobros en efectivo" valor={r.cobrosPorMetodo.efectivo} />
            <Linea etiqueta="Otros ingresos en efectivo" valor={r.ingresosPorMetodo.efectivo} />
            <Linea etiqueta="Gastos en efectivo" valor={-r.egresosPorMetodo.efectivo} />
            <Linea etiqueta="Esperado" valor={c.efectivoEsperado} fuerte />
            <Linea etiqueta="Contado" valor={c.efectivoContado} fuerte />
            <div className={`flex justify-between rounded-md px-3 py-2 font-semibold ${diferencia === 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
              <span>{diferencia === 0 ? "Cuadró" : diferencia > 0 ? "Sobrante" : "Faltante"}</span>
              <span>{formatoMoneda(Math.abs(diferencia))}</span>
            </div>
            <Linea etiqueta="Se quedó de fondo" valor={c.fondoSiguiente} />
            <Linea etiqueta="Se retiró" valor={retirado} />
            {c.notas && <p className="text-muted-foreground border-t pt-2 font-sans whitespace-pre-line">{c.notas}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cobros por método</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm tabular-nums">
            {METODOS.map((m) => (
              <Linea key={m} etiqueta={ETIQUETA_METODO[m]} valor={r.cobrosPorMetodo[m]} />
            ))}
            <Linea etiqueta={`Total (${r.numeroCobros} cobros)`} valor={r.totalCobros} fuerte />
            {Object.keys(r.egresosPorCategoria).length > 0 && (
              <>
                <p className="text-muted-foreground mt-3 font-sans text-xs tracking-wider uppercase">Gastos por categoría</p>
                {Object.entries(r.egresosPorCategoria).map(([cat, v]) => (
                  <Linea key={cat} etiqueta={cat} valor={v} />
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 py-0">
        <CardHeader className="pt-4">
          <CardTitle>Cobros incluidos</CardTitle>
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
            {pagos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground">{formatoFechaHora(p.creadoEn)}</TableCell>
                <TableCell>
                  <Link href={`/ventas/${p.ventaId}`} className="font-mono hover:underline">
                    {p.folio}
                  </Link>
                </TableCell>
                <TableCell>{ETIQUETA_METODO[p.metodo]}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoMoneda(p.monto)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function Linea({ etiqueta, valor, fuerte }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${fuerte ? "border-t pt-2 font-semibold" : ""}`}>
      <span className="font-sans">{etiqueta}</span>
      <span>{valor < 0 ? `−${formatoMoneda(-valor)}` : formatoMoneda(valor)}</span>
    </div>
  );
}
