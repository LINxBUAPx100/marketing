import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { resumenComisiones } from "@/lib/comisiones/servidor";
import { hoyEnMexico, inicioDelDia } from "@/lib/fechas";
import { formatoMoneda, formatoPorcentaje } from "@/lib/numeros";
import { DialogoPagarComisiones } from "./dialogo";

export const metadata: Metadata = { title: "Comisiones" };

export default async function PaginaComisiones() {
  const sesion = await requerirPermiso("comisiones.ver");
  const inicioMes = inicioDelDia(`${hoyEnMexico().slice(0, 8)}01`);
  const [usuarios, resumen] = await Promise.all([
    db
      .select({ id: t.usuario.id, nombre: t.usuario.nombre, comisionBp: t.usuario.comisionBp, activo: t.usuario.activo })
      .from(t.usuario)
      .where(eq(t.usuario.negocioId, sesion.negocio.id))
      .orderBy(asc(t.usuario.nombre)),
    resumenComisiones(sesion.negocio.id, inicioMes),
  ]);
  const filas = usuarios
    .map((u) => ({ ...u, r: resumen.get(u.id) ?? { pagable: 0, porCobrar: 0, pagado: 0, vendido: 0 } }))
    .filter((u) => u.comisionBp > 0 || u.r.pagable || u.r.porCobrar || u.r.pagado);
  const totalPagable = filas.reduce((s, f) => s + f.r.pagable, 0);
  const totalPorCobrar = filas.reduce((s, f) => s + f.r.porCobrar, 0);

  return (
    <>
      <Encabezado
        titulo="Comisiones"
        descripcion="Se calculan al vender sobre el importe sin IVA, con el porcentaje del vendedor o el de la categoría. Se pagan cuando la venta ya está cobrada."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Listas para pagar</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoMoneda(totalPagable)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Esperando que el cliente pague</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoMoneda(totalPorCobrar)}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="hidden text-right md:table-cell">Vendido este mes</TableHead>
              <TableHead className="text-right">Por pagar</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Por cobrar</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Pagado este mes</TableHead>
              {sesion.puede("comisiones.pagar") && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-12 text-center">
                  Nadie tiene comisión. Asígnala en Configuración › Usuarios o por categoría de producto.
                </TableCell>
              </TableRow>
            )}
            {filas.map((f) => (
              <TableRow key={f.id} className={f.activo ? undefined : "opacity-55"}>
                <TableCell>
                  <Link href={`/comisiones/${f.id}`} className="font-medium hover:underline">
                    {f.nombre}
                  </Link>
                  <span className="text-muted-foreground block text-xs">{f.comisionBp ? formatoPorcentaje(f.comisionBp) : "Sin comisión base"}</span>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-right tabular-nums md:table-cell">{formatoMoneda(f.r.vendido)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(f.r.pagable)}</TableCell>
                <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">{formatoMoneda(f.r.porCobrar)}</TableCell>
                <TableCell className="text-muted-foreground hidden text-right tabular-nums lg:table-cell">{formatoMoneda(f.r.pagado)}</TableCell>
                {sesion.puede("comisiones.pagar") && (
                  <TableCell>{f.r.pagable > 0 && <DialogoPagarComisiones usuarioId={f.id} nombre={f.nombre} monto={f.r.pagable} sucursal={sesion.sucursal?.nombre ?? null} />}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
