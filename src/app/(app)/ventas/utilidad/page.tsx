import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { ingresoSinIva } from "@/lib/almacen/reglas";
import { requerirPermiso } from "@/lib/auth";
import { esFecha, hoyEnMexico, rangoDeDias } from "@/lib/fechas";
import { formatoCantidad, formatoMoneda } from "@/lib/numeros";

export const metadata: Metadata = { title: "Utilidad" };

const porcentaje = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)} %`);

export default async function PaginaUtilidad({ searchParams }: PageProps<"/ventas/utilidad">) {
  const sesion = await requerirPermiso("productos.costos");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const hoy = hoyEnMexico();
  const desde = esFecha(sp.desde) ? sp.desde : `${hoy.slice(0, 8)}01`;
  const hasta = esFecha(sp.hasta) ? sp.hasta : hoy;
  const rango = rangoDeDias(desde, hasta);
  const misSucursales = sesion.sucursales.map((s) => s.id);
  const iva = sesion.negocio;

  const partidas = misSucursales.length
    ? await db
        .select({ productoId: t.ventaPartida.productoId, descripcion: t.ventaPartida.descripcion, unidad: t.ventaPartida.unidad, cantidad: t.ventaPartida.cantidad, importe: t.ventaPartida.importe, costo: t.ventaPartida.costo })
        .from(t.ventaPartida)
        .innerJoin(t.venta, eq(t.venta.id, t.ventaPartida.ventaId))
        .where(and(eq(t.venta.negocioId, sesion.negocio.id), inArray(t.venta.sucursalId, misSucursales), eq(t.venta.estado, "activa"), gte(t.venta.creadoEn, rango.inicio), lt(t.venta.creadoEn, rango.fin)))
    : [];

  // Agrupa por producto (los conceptos libres, por su descripción).
  const grupos = new Map<string, { nombre: string; unidad: string; cantidad: number; ingreso: number; costo: number; sinCosto: number; libre: boolean }>();
  for (const p of partidas) {
    const clave = p.productoId ?? `libre:${p.descripcion.toLowerCase()}`;
    const g = grupos.get(clave) ?? { nombre: p.descripcion, unidad: p.unidad, cantidad: 0, ingreso: 0, costo: 0, sinCosto: 0, libre: !p.productoId };
    g.cantidad += p.cantidad;
    const ingreso = ingresoSinIva(p.importe, iva);
    g.ingreso += ingreso;
    if (p.costo == null) g.sinCosto += ingreso;
    else g.costo += p.costo;
    grupos.set(clave, g);
  }
  const filas = [...grupos.values()].sort((a, b) => b.ingreso - a.ingreso);
  const total = filas.reduce((s, f) => ({ ingreso: s.ingreso + f.ingreso, costo: s.costo + f.costo, sinCosto: s.sinCosto + f.sinCosto }), { ingreso: 0, costo: 0, sinCosto: 0 });
  // La utilidad solo se mide sobre lo que tiene costo conocido.
  const conCosto = total.ingreso - total.sinCosto;
  const utilidad = conCosto - total.costo;

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/ventas" />}>
        <ArrowLeft /> Ventas
      </Button>
      <Encabezado titulo="Utilidad por producto" descripcion={`Del ${desde} al ${hasta}. Importes sin IVA. El costo sale de la receta o del costo capturado al momento de vender.`}>
        <form className="flex flex-wrap items-center gap-2">
          <Input type="date" name="desde" defaultValue={desde} key={desde} className="h-9 w-auto" aria-label="Desde" />
          <Input type="date" name="hasta" defaultValue={hasta} key={hasta} className="h-9 w-auto" aria-label="Hasta" />
          <Button type="submit" variant="outline" className="h-9">
            Ver
          </Button>
        </form>
      </Encabezado>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Vendido (sin IVA)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoMoneda(total.ingreso)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Utilidad</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoMoneda(utilidad)}</CardTitle>
            <CardDescription>Margen {porcentaje(conCosto > 0 ? utilidad / conCosto : null)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Vendido sin costo conocido</CardDescription>
            <CardTitle className={`text-2xl tabular-nums ${total.sinCosto ? "text-amber-700" : ""}`}>{formatoMoneda(total.sinCosto)}</CardTitle>
            <CardDescription>Agrega recetas o costos para medirlo.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Cantidad</TableHead>
              <TableHead className="text-right">Vendido</TableHead>
              <TableHead className="hidden text-right md:table-cell">Costo</TableHead>
              <TableHead className="text-right">Utilidad</TableHead>
              <TableHead className="text-right">Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-12 text-center">
                  No hay ventas en estas fechas.
                </TableCell>
              </TableRow>
            )}
            {filas.map((f) => {
              const medible = f.ingreso - f.sinCosto;
              const u = medible - f.costo;
              const margen = medible > 0 ? u / medible : null;
              return (
                <TableRow key={f.nombre + f.unidad}>
                  <TableCell className="whitespace-normal">
                    <span className="font-medium">{f.nombre}</span> {f.libre && <Badge variant="outline">Libre</Badge>}
                    {f.sinCosto > 0 && <span className="block text-xs text-amber-700">Sin costo en {formatoMoneda(f.sinCosto)} de lo vendido</span>}
                  </TableCell>
                  <TableCell className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">
                    {formatoCantidad(f.cantidad)} <span className="text-muted-foreground text-xs">{f.unidad}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(f.ingreso)}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-right tabular-nums md:table-cell">{medible > 0 ? formatoMoneda(f.costo) : "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{medible > 0 ? formatoMoneda(u) : "—"}</TableCell>
                  <TableCell className={`text-right tabular-nums ${margen != null && margen < 0.2 ? "text-destructive font-medium" : ""}`}>{porcentaje(margen)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {filas.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-right tabular-nums">{formatoMoneda(total.ingreso)}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{formatoMoneda(total.costo)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatoMoneda(utilidad)}</TableCell>
                <TableCell className="text-right tabular-nums">{porcentaje(conCosto > 0 ? utilidad / conCosto : null)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>
    </>
  );
}
