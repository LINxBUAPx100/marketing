import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
import { maquinasCompletas } from "@/lib/maquinas/consultas";
import { costoPorMil, ETIQUETA_MOTIVO_MERMA, ETIQUETA_TIPO } from "@/lib/maquinas/reglas";
import { formatoCantidad, formatoFecha, formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { usuariosActivos } from "@/lib/produccion/consultas";
import { BotonRetirar, DialogoConsumible, DialogoContador, DialogoMaquina, DialogoMerma } from "../dialogos";

export const metadata: Metadata = { title: "Máquina" };

const MOMENTO = { apertura: "Apertura", cierre: "Cierre", otra: "" } as const;

export default async function PaginaMaquina({ params }: PageProps<"/maquinas/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("maquinas.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [m] = (await maquinasCompletas(sesion.negocio.id, sesion.sucursales.map((s) => s.id), false)).filter((x) => x.id === id);
  if (!m) notFound();

  const ids = m.contadores.map((c) => c.id);
  const responsable = alias(t.usuario, "responsable");
  const [lecturas, mermas, historial, insumos, usuarios] = await Promise.all([
    ids.length
      ? db
          .select({ id: t.lecturaContador.id, contadorId: t.lecturaContador.contadorId, valor: t.lecturaContador.valor, momento: t.lecturaContador.momento, nota: t.lecturaContador.nota, creadoEn: t.lecturaContador.creadoEn, usuario: t.usuario.nombre })
          .from(t.lecturaContador)
          .innerJoin(t.usuario, eq(t.usuario.id, t.lecturaContador.usuarioId))
          .where(inArray(t.lecturaContador.contadorId, ids))
          .orderBy(desc(t.lecturaContador.creadoEn))
          .limit(60)
      : [],
    db
      .select({ merma: t.merma, responsable: responsable.nombre })
      .from(t.merma)
      .leftJoin(responsable, eq(responsable.id, t.merma.responsableId))
      .where(eq(t.merma.maquinaId, id))
      .orderBy(desc(t.merma.creadoEn))
      .limit(30),
    db
      .select()
      .from(t.consumible)
      .where(and(eq(t.consumible.maquinaId, id), isNotNull(t.consumible.retiradoEn)))
      .orderBy(desc(t.consumible.retiradoEn))
      .limit(20),
    db
      .select({ id: t.insumo.id, nombre: t.insumo.nombre, existencia: sql<number>`coalesce(${t.existenciaInsumo.cantidad}, 0)::float` })
      .from(t.insumo)
      .leftJoin(t.existenciaInsumo, and(eq(t.existenciaInsumo.insumoId, t.insumo.id), eq(t.existenciaInsumo.sucursalId, m.sucursalId)))
      .where(and(eq(t.insumo.negocioId, sesion.negocio.id), eq(t.insumo.activo, true)))
      .orderBy(asc(t.insumo.nombre)),
    usuariosActivos(sesion.negocio.id),
  ]);
  const nombreContador = new Map(m.contadores.map((c) => [c.id, c.nombre]));
  // Diferencia de cada lectura contra la anterior del mismo contador.
  const conDiferencia = lecturas.map((l, i) => {
    const anterior = lecturas.slice(i + 1).find((x) => x.contadorId === l.contadorId);
    return { ...l, diferencia: anterior ? l.valor - anterior.valor : null };
  });

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/maquinas" />}>
        <ArrowLeft /> Máquinas
      </Button>
      <Encabezado titulo={m.nombre} descripcion={[m.marca, m.modelo, m.serie && `Serie ${m.serie}`, m.sucursal, !m.activa && "fuera de uso"].filter(Boolean).join(" · ")}>
        {sesion.puede("maquinas.mermas") && (
          <DialogoMerma maquinas={[{ id: m.id, nombre: m.nombre, tipos: [...new Set(m.contadores.map((c) => c.tipo))] }]} usuarios={usuarios} usuarioActual={sesion.usuario.id} maquinaInicial={m.id} />
        )}
        {sesion.puede("maquinas.editar") && (
          <DialogoMaquina
            sucursales={sesion.sucursales}
            sucursalActual={m.sucursalId}
            maquina={{ id: m.id, sucursalId: m.sucursalId, nombre: m.nombre, marca: m.marca ?? "", modelo: m.modelo ?? "", serie: m.serie ?? "", notas: m.notas ?? "", activa: m.activa }}
          />
        )}
      </Encabezado>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contadores</CardTitle>
              {sesion.puede("maquinas.editar") && <DialogoContador maquinaId={m.id} />}
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {m.contadores.map((c) => (
                <div key={c.id} className="flex justify-between gap-2">
                  <span>
                    {c.nombre} <span className="text-muted-foreground block text-xs">{ETIQUETA_TIPO[c.tipo]}</span>
                  </span>
                  <span className="font-mono font-semibold tabular-nums">{c.ultima ? formatoCantidad(c.ultima.valor) : "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consumibles</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {m.consumibles.length === 0 && <p className="text-muted-foreground">Sin consumibles registrados.</p>}
              {m.consumibles.map((c) => {
                const pct = Math.min(1, c.desgaste.porcentaje);
                return (
                  <div key={c.id} className="grid gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{c.nombre}</span>
                      {sesion.puede("consumibles.editar") && <BotonRetirar id={c.id} nombre={c.nombre} />}
                    </div>
                    <span className="bg-muted h-2 overflow-hidden rounded-full">
                      <span className={`block h-full rounded-full ${pct >= 0.9 ? "bg-destructive" : pct >= 0.7 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${pct * 100}%` }} />
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatoCantidad(c.desgaste.usado)} de {formatoCantidad(c.rendimiento)} ({Math.round(c.desgaste.porcentaje * 100)} %) · desde {formatoFecha(c.instaladoEn)} · {nombreContador.get(c.contadorId)}
                      {c.desgaste.seAcabaEn && ` · se acabaría ~${formatoFecha(c.desgaste.seAcabaEn)}`}
                    </span>
                  </div>
                );
              })}
              {sesion.puede("consumibles.editar") && m.contadores.length > 0 && (
                <DialogoConsumible maquinaId={m.id} contadores={m.contadores.map((c) => ({ id: c.id, nombre: c.nombre }))} insumos={insumos} />
              )}
            </CardContent>
          </Card>

          {historial.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rendimiento real</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {historial.map((c) => {
                  const dio = (c.lecturaRetiro ?? c.lecturaInstalacion) - c.lecturaInstalacion;
                  const porMil = c.costo != null ? costoPorMil(c.costo, dio) : null;
                  return (
                    <div key={c.id} className="flex justify-between gap-2">
                      <span>
                        {c.nombre}
                        <span className="text-muted-foreground block text-xs">
                          {formatoFecha(c.instaladoEn)} – {formatoFecha(c.retiradoEn)}
                        </span>
                      </span>
                      <span className="text-right tabular-nums">
                        <span className={dio < c.rendimiento * 0.8 ? "text-destructive font-medium" : ""}>{Math.round((dio / c.rendimiento) * 100)} %</span>
                        <span className="text-muted-foreground block text-xs">
                          {formatoCantidad(dio)} imp.{porMil != null && ` · ${formatoMoneda(porMil)}/millar`}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid min-w-0 content-start gap-6">
          <Card className="py-0">
            <CardHeader className="pt-4">
              <CardTitle>Lecturas</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Contador</TableHead>
                  <TableHead className="text-right">Lectura</TableHead>
                  <TableHead className="text-right">Impresiones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conDiferencia.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatoFechaHora(l.creadoEn)}
                      <span className="block text-xs">
                        {[MOMENTO[l.momento], l.usuario].filter(Boolean).join(" · ")}
                        {l.nota ? ` · ${l.nota}` : ""}
                      </span>
                    </TableCell>
                    <TableCell>{nombreContador.get(l.contadorId)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatoCantidad(l.valor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.diferencia != null ? `+${formatoCantidad(l.diferencia)}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="py-0">
            <CardHeader className="pt-4">
              <CardTitle>Mermas</CardTitle>
            </CardHeader>
            <Table>
              <TableBody>
                {mermas.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground py-6 text-center">Sin mermas registradas.</TableCell>
                  </TableRow>
                )}
                {mermas.map(({ merma: x, responsable }) => (
                  <TableRow key={x.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatoFechaHora(x.creadoEn)}</TableCell>
                    <TableCell className="whitespace-normal">
                      {ETIQUETA_MOTIVO_MERMA[x.motivo]}
                      <span className="text-muted-foreground block text-xs">{[ETIQUETA_TIPO[x.tipo], responsable, x.nota].filter(Boolean).join(" · ")}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatoCantidad(x.cantidad)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}
