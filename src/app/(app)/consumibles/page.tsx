import { and, inArray, isNotNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { maquinasCompletas } from "@/lib/maquinas/consultas";
import { formatoCantidad, formatoFecha, formatoMoneda } from "@/lib/numeros";

export const metadata: Metadata = { title: "Consumibles" };

export default async function PaginaConsumibles() {
  const sesion = await requerirPermiso("consumibles.ver");
  const misSucursales = sesion.sucursales.map((s) => s.id);
  const maquinas = await maquinasCompletas(sesion.negocio.id, misSucursales);
  const instalados = maquinas
    .flatMap((m) => m.consumibles.map((c) => ({ ...c, maquina: m.nombre, maquinaId: m.id, sucursal: m.sucursal })))
    .sort((a, b) => b.desgaste.porcentaje - a.desgaste.porcentaje);

  // Costo por millar de cada equipo con los consumibles ya retirados (rendimiento real).
  const ids = maquinas.map((m) => m.id);
  const retirados = ids.length
    ? await db
        .select()
        .from(t.consumible)
        .where(and(inArray(t.consumible.maquinaId, ids), isNotNull(t.consumible.retiradoEn)))
    : [];
  const ranking = maquinas
    .map((m) => {
      const propios = retirados.filter((r) => r.maquinaId === m.id && r.costo != null);
      // Una impresión gasta un poco de cada consumible (negro, cian, tambor…): se suma el costo por
      // impresión de cada uno, calculado con lo que realmente rindió.
      const porNombre = new Map<string, { costo: number; impresiones: number }>();
      for (const r of propios) {
        const g = porNombre.get(r.nombre) ?? { costo: 0, impresiones: 0 };
        g.costo += r.costo ?? 0;
        g.impresiones += (r.lecturaRetiro ?? r.lecturaInstalacion) - r.lecturaInstalacion;
        porNombre.set(r.nombre, g);
      }
      const porImpresion = [...porNombre.values()].reduce((s, g) => s + (g.impresiones > 0 ? g.costo / g.impresiones : 0), 0);
      const debajo = propios.filter((r) => (r.lecturaRetiro ?? 0) - r.lecturaInstalacion < r.rendimiento * 0.8).length;
      return { id: m.id, nombre: m.nombre, cambios: propios.length, porMil: porImpresion > 0 ? Math.round(porImpresion * 1000) : null, debajo };
    })
    .filter((r) => r.cambios > 0)
    .sort((a, b) => (b.porMil ?? 0) - (a.porMil ?? 0));
  const porCambiar = instalados.filter((c) => c.desgaste.porcentaje >= 0.9).length;

  return (
    <>
      <Encabezado titulo="Consumibles" descripcion="Tóner, tambores y demás piezas instaladas. Se instalan y retiran desde la ficha de cada máquina." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Instalados</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{instalados.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Por cambiar (90 % o más)</CardDescription>
            <CardTitle className={`text-2xl tabular-nums ${porCambiar ? "text-destructive" : ""}`}>{porCambiar}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consumible</TableHead>
                <TableHead className="w-40">Uso</TableHead>
                <TableHead className="hidden text-right md:table-cell">Se acabaría</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instalados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground py-12 text-center">
                    No hay consumibles registrados. Instálalos desde la ficha de cada máquina.
                  </TableCell>
                </TableRow>
              )}
              {instalados.map((c) => {
                const pct = Math.min(1, c.desgaste.porcentaje);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="font-medium">{c.nombre}</span>
                      <Link href={`/maquinas/${c.maquinaId}`} className="text-muted-foreground block text-xs hover:underline">
                        {c.maquina}
                        {sesion.sucursales.length > 1 ? ` · ${c.sucursal}` : ""}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                          <span className={`block h-full rounded-full ${pct >= 0.9 ? "bg-destructive" : pct >= 0.7 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${pct * 100}%` }} />
                        </span>
                        <span className="w-10 text-right text-xs tabular-nums">{Math.round(c.desgaste.porcentaje * 100)} %</span>
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {formatoCantidad(c.desgaste.usado)} / {formatoCantidad(c.rendimiento)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      {c.desgaste.restante <= 0 ? <Badge variant="destructive">Ya rindió lo esperado</Badge> : c.desgaste.seAcabaEn ? formatoFecha(c.desgaste.seAcabaEn) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        <Card className="content-start">
          <CardHeader>
            <CardTitle>Qué equipo consume más</CardTitle>
            <CardDescription>Costo de consumibles por cada 1,000 impresiones, con los que ya se cambiaron.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {ranking.length === 0 && <p className="text-muted-foreground">Aparece cuando se retire el primer consumible con costo.</p>}
            {ranking.map((r) => (
              <div key={r.id} className="flex justify-between gap-2">
                <span>
                  {r.nombre}
                  <span className="text-muted-foreground block text-xs">
                    {r.cambios} cambios{r.debajo ? ` · ${r.debajo} rindieron menos del 80 %` : ""}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{r.porMil != null ? formatoMoneda(r.porMil) : "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
