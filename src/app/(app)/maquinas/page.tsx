import { ClipboardPen, ScanSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { FiltroSelect } from "@/components/filtro-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requerirPermiso } from "@/lib/auth";
import { maquinasCompletas } from "@/lib/maquinas/consultas";
import { ETIQUETA_TIPO } from "@/lib/maquinas/reglas";
import { formatoCantidad, formatoFecha, formatoFechaHora } from "@/lib/numeros";
import { usuariosActivos } from "@/lib/produccion/consultas";
import { DialogoMaquina, DialogoMerma } from "./dialogos";

export const metadata: Metadata = { title: "Máquinas" };

export default async function PaginaMaquinas({ searchParams }: PageProps<"/maquinas">) {
  const sesion = await requerirPermiso("maquinas.ver");
  const { sucursal: sucursalParam } = (await searchParams) as Record<string, string | undefined>;
  const misSucursales = sesion.sucursales.map((s) => s.id);
  const sucursal = sucursalParam && misSucursales.includes(sucursalParam) ? sucursalParam : null;
  const [maquinas, usuarios] = await Promise.all([maquinasCompletas(sesion.negocio.id, sucursal ? [sucursal] : misSucursales), usuariosActivos(sesion.negocio.id)]);
  const opcionesMerma = maquinas.map((m) => ({ id: m.id, nombre: m.nombre, tipos: [...new Set(m.contadores.map((c) => c.tipo))] }));

  return (
    <>
      <Encabezado titulo="Máquinas y contadores" descripcion="Equipos de impresión, sus contadores y el estado de sus consumibles.">
        <Button variant="ghost" nativeButton={false} render={<Link href="/maquinas/control" />}>
          <ScanSearch /> Impresiones fantasma
        </Button>
        {sesion.puede("maquinas.mermas") && maquinas.length > 0 && <DialogoMerma maquinas={opcionesMerma} usuarios={usuarios} usuarioActual={sesion.usuario.id} />}
        {sesion.puede("maquinas.lecturas") && maquinas.length > 0 && (
          <Button variant="outline" nativeButton={false} render={<Link href="/maquinas/lecturas" />}>
            <ClipboardPen /> Capturar lecturas
          </Button>
        )}
        {sesion.puede("maquinas.editar") && <DialogoMaquina sucursales={sesion.sucursales} sucursalActual={sesion.sucursal?.id ?? null} />}
      </Encabezado>

      {sesion.sucursales.length > 1 && (
        <form className="mb-4">
          <FiltroSelect nombre="sucursal" valor={sucursal ?? ""} etiqueta="Sucursal">
            <option value="">Todas mis sucursales</option>
            {sesion.sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </FiltroSelect>
        </form>
      )}

      {maquinas.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">Aún no hay equipos. Registra tus impresoras, copiadoras y plotters con «Nuevo equipo».</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {maquinas.map((m) => {
          const critico = m.consumibles.find((c) => c.desgaste.porcentaje >= 0.9);
          return (
            <Card key={m.id} className="content-start">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle>
                      <Link href={`/maquinas/${m.id}`} className="hover:underline">
                        {m.nombre}
                      </Link>
                    </CardTitle>
                    <p className="text-muted-foreground truncate text-xs">{[m.marca, m.modelo, sesion.sucursales.length > 1 ? m.sucursal : null].filter(Boolean).join(" · ")}</p>
                  </div>
                  {critico && <Badge variant="destructive">Cambiar {critico.nombre.toLowerCase()}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <ul className="grid gap-1.5">
                  {m.contadores.map((c) => (
                    <li key={c.id} className="flex items-baseline justify-between gap-2">
                      <span>
                        {c.nombre} <span className="text-muted-foreground text-xs">{ETIQUETA_TIPO[c.tipo]}</span>
                      </span>
                      <span className="text-right">
                        <span className="font-mono font-semibold tabular-nums">{c.ultima ? formatoCantidad(c.ultima.valor) : "—"}</span>
                        {c.ultima && <span className="text-muted-foreground block text-[0.7rem]">{formatoFechaHora(c.ultima.creadoEn)}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {m.consumibles.length > 0 && (
                  <ul className="grid gap-2 border-t pt-3">
                    {m.consumibles.map((c) => {
                      const pct = Math.min(1, c.desgaste.porcentaje);
                      return (
                        <li key={c.id} className="grid gap-1">
                          <span className="flex justify-between text-xs">
                            <span>{c.nombre}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {Math.round(pct * 100)} %{c.desgaste.seAcabaEn ? ` · ~${formatoFecha(c.desgaste.seAcabaEn)}` : ""}
                            </span>
                          </span>
                          <span className="bg-muted h-1.5 overflow-hidden rounded-full">
                            <span className={`block h-full rounded-full ${pct >= 0.9 ? "bg-destructive" : pct >= 0.7 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${pct * 100}%` }} />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
