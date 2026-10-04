import { inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { FiltroSelect } from "@/components/filtro-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { esFecha, hoyEnMexico, rangoDeDias } from "@/lib/fechas";
import { ETIQUETA_MOTIVO_MERMA, ETIQUETA_TIPO, impresionesFantasma, type TipoImpresion } from "@/lib/maquinas/reglas";
import { controlDeImpresiones } from "@/lib/maquinas/servidor";
import { formatoCantidad } from "@/lib/numeros";

export const metadata: Metadata = { title: "Impresiones fantasma" };

export default async function PaginaControl({ searchParams }: PageProps<"/maquinas/control">) {
  const sesion = await requerirPermiso("maquinas.ver");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const misSucursales = sesion.sucursales.map((s) => s.id);
  const sucursalId = sp.sucursal && misSucursales.includes(sp.sucursal) ? sp.sucursal : (sesion.sucursal?.id ?? misSucursales[0]);
  if (!sucursalId) return <Encabezado titulo="Impresiones fantasma" descripcion="No tienes sucursales asignadas." />;
  const hoy = hoyEnMexico();
  const desde = esFecha(sp.desde) ? sp.desde : hoy;
  const hasta = esFecha(sp.hasta) ? sp.hasta : hoy;
  const rango = rangoDeDias(desde, hasta);

  const { porContador, vendidas, mermas } = await controlDeImpresiones(sesion.negocio.id, sucursalId, rango.inicio, rango.fin);
  const responsables = mermas.some((m) => m.responsableId)
    ? await db
        .select({ id: t.usuario.id, nombre: t.usuario.nombre })
        .from(t.usuario)
        .where(inArray(t.usuario.id, [...new Set(mermas.map((m) => m.responsableId).filter((x): x is string => !!x))]))
    : [];
  const nombreDe = new Map(responsables.map((r) => [r.id, r.nombre]));

  // Resumen por tipo de impresión.
  const tipos = [...new Set(porContador.map((c) => c.tipo))] as TipoImpresion[];
  const resumen = tipos.map((tipo) => {
    const contadores = porContador.filter((c) => c.tipo === tipo);
    const sinMedir = contadores.filter((c) => !c.medicion).length;
    const contador = contadores.reduce((s, c) => s + (c.medicion?.impresiones ?? 0), 0);
    const vendido = vendidas.find((v) => v.tipo === tipo)?.impresiones ?? 0;
    const merma = mermas.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.cantidad, 0);
    // Si ningún contador de este tipo se pudo medir, no hay con qué comparar.
    return { tipo, contador, vendido, merma, sinMedir, medible: sinMedir < contadores.length, ...impresionesFantasma({ contador, vendidas: vendido, mermas: merma }) };
  });

  const agrupar = (clave: (m: (typeof mermas)[number]) => string) => {
    const mapa = new Map<string, number>();
    for (const m of mermas) mapa.set(clave(m), (mapa.get(clave(m)) ?? 0) + m.cantidad);
    return [...mapa].sort((a, b) => b[1] - a[1]);
  };
  const porPersona = agrupar((m) => (m.responsableId ? (nombreDe.get(m.responsableId) ?? "—") : "Sin responsable"));
  const porMotivo = agrupar((m) => ETIQUETA_MOTIVO_MERMA[m.motivo]);
  const nombreSucursal = sesion.sucursales.find((s) => s.id === sucursalId)?.nombre;

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/maquinas" />}>
        <ArrowLeft /> Máquinas
      </Button>
      <Encabezado
        titulo="Impresiones fantasma"
        descripcion={`${nombreSucursal} · ${desde === hasta ? desde : `del ${desde} al ${hasta}`}. Lo que marcaron los contadores, menos lo vendido y las mermas registradas.`}
      >
        <form className="flex flex-wrap items-center gap-2">
          {sesion.sucursales.length > 1 && (
            <FiltroSelect nombre="sucursal" valor={sucursalId} etiqueta="Sucursal">
              {sesion.sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </FiltroSelect>
          )}
          <Input type="date" name="desde" defaultValue={desde} key={`d${desde}`} className="h-9 w-auto" aria-label="Desde" />
          <Input type="date" name="hasta" defaultValue={hasta} key={`h${hasta}`} className="h-9 w-auto" aria-label="Hasta" />
          <Button type="submit" variant="outline" className="h-9">
            Ver
          </Button>
        </form>
      </Encabezado>

      {resumen.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">No hay equipos con contadores en esta sucursal.</CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {resumen.map((r) => (
          <Card key={r.tipo}>
            <CardHeader>
              <CardDescription>{ETIQUETA_TIPO[r.tipo]}</CardDescription>
              {r.medible ? (
                <>
                  <CardTitle className={`text-3xl tabular-nums ${r.fantasma > 0 ? "text-destructive" : ""}`}>
                    {r.fantasma > 0 ? formatoCantidad(r.fantasma) : r.fantasma < 0 ? `−${formatoCantidad(-r.fantasma)}` : "0"}
                  </CardTitle>
                  <CardDescription>
                    {r.fantasma > 0 ? "impresiones sin cobrar" : r.fantasma < 0 ? "se vendió más de lo que marcó el contador" : "todo cuadra"}
                    {r.porcentaje != null && r.fantasma > 0 && ` · ${Math.round(r.porcentaje * 100)} % de lo impreso`}
                  </CardDescription>
                </>
              ) : (
                <>
                  <CardTitle className="text-muted-foreground text-xl">Faltan lecturas</CardTitle>
                  <CardDescription>Captura la lectura de apertura y la de cierre para poder comparar.</CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent className="grid gap-1 text-sm tabular-nums">
              <Linea etiqueta="Marcó el contador" valor={r.contador} />
              <Linea etiqueta="Vendido" valor={r.vendido} />
              <Linea etiqueta="Mermas" valor={r.merma} />
              {r.sinMedir > 0 && <p className="mt-1 text-xs text-amber-700">{r.sinMedir} contador(es) sin lecturas suficientes en el periodo.</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0 py-0">
          <CardHeader className="pt-4">
            <CardTitle>Por equipo</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contador</TableHead>
                <TableHead className="text-right">Inicio</TableHead>
                <TableHead className="text-right">Final</TableHead>
                <TableHead className="text-right">Impresiones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porContador.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/maquinas/${c.maquinaId}`} className="font-medium hover:underline">
                      {c.maquina}
                    </Link>
                    <span className="text-muted-foreground block text-xs">
                      {c.nombre} · {ETIQUETA_TIPO[c.tipo]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{c.medicion ? formatoCantidad(c.medicion.desde) : "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{c.medicion ? formatoCantidad(c.medicion.hasta) : "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{c.medicion ? formatoCantidad(c.medicion.impresiones) : <Badge variant="outline">Faltan lecturas</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Mermas por persona</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1.5 text-sm">
              {porPersona.length === 0 && <p className="text-muted-foreground">Sin mermas en el periodo.</p>}
              {porPersona.map(([nombre, cantidad]) => (
                <Linea key={nombre} etiqueta={nombre} valor={cantidad} />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Mermas por motivo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1.5 text-sm">
              {porMotivo.length === 0 && <p className="text-muted-foreground">Sin mermas en el periodo.</p>}
              {porMotivo.map(([motivo, cantidad]) => (
                <Linea key={motivo} etiqueta={motivo} valor={cantidad} />
              ))}
            </CardContent>
          </Card>
          <p className="text-muted-foreground text-xs">
            Lo vendido se calcula con las «impresiones por unidad» de cada producto. Si un producto no las tiene, sus ventas no cuentan aquí: configúralas en la ficha del producto.
          </p>
        </div>
      </div>
    </>
  );
}

function Linea({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="tabular-nums">{formatoCantidad(valor)}</span>
    </div>
  );
}
