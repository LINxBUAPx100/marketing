import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requerirPermiso } from "@/lib/auth";
import { ingresoSinIva } from "@/lib/almacen/reglas";
import { ETIQUETA_METODO, type Metodo } from "@/lib/caja/resumen";
import { esFecha, hoyEnMexico } from "@/lib/fechas";
import { formatoCantidad, formatoFecha, formatoMoneda, formatoPorcentaje } from "@/lib/numeros";
import { reporteVentas } from "@/lib/reportes/consultas";
import { participacion, promedio, variacion } from "@/lib/reportes/reglas";

export const metadata: Metadata = { title: "Reportes" };

const DIA_MS = 86_400_000;
const ventas = (n: number) => `${n} ${n === 1 ? "venta" : "ventas"}`;
const sumarDias = (fecha: string, dias: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);

function atajos(hoy: string) {
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const finMesPasado = sumarDias(inicioMes, -1);
  return [
    { etiqueta: "Hoy", desde: hoy, hasta: hoy },
    { etiqueta: "7 días", desde: sumarDias(hoy, -6), hasta: hoy },
    { etiqueta: "Este mes", desde: inicioMes, hasta: hoy },
    { etiqueta: "Mes pasado", desde: `${finMesPasado.slice(0, 8)}01`, hasta: finMesPasado },
    { etiqueta: "Este año", desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy },
  ];
}

export default async function PaginaReportes({ searchParams }: PageProps<"/reportes">) {
  const sesion = await requerirPermiso("reportes.ver");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const hoy = hoyEnMexico();
  let desde = esFecha(sp.desde) ? sp.desde : `${hoy.slice(0, 8)}01`;
  let hasta = esFecha(sp.hasta) ? sp.hasta : hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  // Máximo un año para que el reporte responda rápido.
  if (Date.parse(hasta) - Date.parse(desde) > 366 * DIA_MS) desde = sumarDias(hasta, -366);
  const sucursal = sesion.sucursales.find((s) => s.id === sp.sucursal) ?? null;
  const sucursalIds = sucursal ? [sucursal.id] : sesion.sucursales.map((s) => s.id);

  const r = await reporteVentas({ negocioId: sesion.negocio.id, sucursalIds, desde, hasta });
  const consulta = new URLSearchParams({ desde, hasta, ...(sucursal ? { sucursal: sucursal.id } : {}) }).toString();

  return (
    <>
      <Encabezado
        titulo="Reportes"
        descripcion={`Del ${formatoFecha(new Date(`${desde}T12:00:00-06:00`))} al ${formatoFecha(new Date(`${hasta}T12:00:00-06:00`))} · ${sucursal?.nombre ?? "Todas mis sucursales"}. Ventas activas con IVA.`}
      >
        <Button variant="outline" nativeButton={false} render={<a href={`/exportar/reporte?${consulta}`} />}>
          <Download /> Excel
        </Button>
      </Encabezado>

      <form className="mb-3 flex flex-wrap items-center gap-2">
        <Input type="date" name="desde" defaultValue={desde} key={`d${desde}`} className="h-9 w-auto" aria-label="Desde" />
        <Input type="date" name="hasta" defaultValue={hasta} key={`h${hasta}`} className="h-9 w-auto" aria-label="Hasta" />
        {sesion.sucursales.length > 1 && (
          <select
            name="sucursal"
            defaultValue={sucursal?.id ?? ""}
            aria-label="Sucursal"
            className="border-input bg-background focus-visible:ring-ring/50 h-9 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
          >
            <option value="">Todas mis sucursales</option>
            {sesion.sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        )}
        <Button type="submit" variant="outline" className="h-9">
          Ver
        </Button>
      </form>
      <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Periodos">
        {atajos(hoy).map((a) => {
          const activo = a.desde === desde && a.hasta === hasta;
          const q = new URLSearchParams({ desde: a.desde, hasta: a.hasta, ...(sucursal ? { sucursal: sucursal.id } : {}) });
          return (
            <Link
              key={a.etiqueta}
              href={`/reportes?${q}`}
              className={`rounded-full border px-3 py-1 text-xs ${activo ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
            >
              {a.etiqueta}
            </Link>
          );
        })}
      </nav>

      {!r ? (
        <p className="text-muted-foreground text-sm">No tienes sucursales asignadas.</p>
      ) : (
        <Contenido r={r} negocio={sesion.negocio} verCostos={sesion.puede("productos.costos")} />
      )}
    </>
  );
}

type Reporte = NonNullable<Awaited<ReturnType<typeof reporteVentas>>>;

function Contenido({ r, negocio, verCostos }: { r: Reporte; negocio: { ivaBp: number; preciosIncluyenIva: boolean }; verCostos: boolean }) {
  const { actual, anterior } = r;
  const cambio = variacion(actual.total, anterior.total);
  const baseConCosto = ingresoSinIva(r.utilidad.importe, negocio);
  const utilidad = baseConCosto - r.utilidad.costo;
  const gastos = r.gastos.reduce((s, g) => s + g.total, 0);
  const maxDia = Math.max(1, ...r.porDia.map((d) => d.total));
  const muchosDias = r.porDia.length > 45;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          etiqueta="Vendido"
          valor={formatoMoneda(actual.total)}
          detalle={cambio == null ? ventas(actual.ventas) : `${ventas(actual.ventas)} · ${cambio >= 0 ? "▲" : "▼"} ${formatoPorcentaje(Math.abs(cambio))} vs. periodo anterior`}
          tono={cambio == null ? undefined : cambio >= 0 ? "bien" : "mal"}
        />
        <Kpi etiqueta="Ticket promedio" valor={formatoMoneda(promedio(actual.total, actual.ventas))} detalle={`Antes: ${formatoMoneda(promedio(anterior.total, anterior.ventas))}`} />
        <Kpi etiqueta="Cobrado" valor={formatoMoneda(r.cobrado)} detalle={`Incluye abonos de ventas anteriores · saldo pendiente ${formatoMoneda(actual.saldo)}`} />
        {verCostos ? (
          <Kpi
            etiqueta="Utilidad bruta"
            valor={formatoMoneda(utilidad)}
            detalle={`Margen ${formatoPorcentaje(participacion(utilidad, baseConCosto))}${r.utilidad.sinCosto ? ` · ${r.utilidad.sinCosto} partidas sin costo` : ""}`}
          />
        ) : (
          <Kpi etiqueta="Canceladas" valor={String(r.canceladas.ventas)} detalle={formatoMoneda(r.canceladas.total)} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas por día</CardTitle>
          <CardDescription>Pasa el cursor sobre una barra para ver el detalle.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-px sm:gap-1" role="img" aria-label="Gráfica de ventas por día">
            {r.porDia.map((d) => (
              <div key={d.dia} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.dia}: ${formatoMoneda(d.total)} · ${ventas(d.ventas)}`}>
                <div className="bg-primary/80 group-hover:bg-primary min-h-px rounded-t-sm" style={{ height: `${(d.total / maxDia) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="text-muted-foreground mt-2 flex justify-between text-xs">
            <span>{r.porDia[0]?.dia.slice(5).split("-").reverse().join("/")}</span>
            {!muchosDias && r.porDia.length > 2 && <span>Máx. {formatoMoneda(maxDia)}</span>}
            <span>{r.porDia.at(-1)?.dia.slice(5).split("-").reverse().join("/")}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Ranking titulo="Productos más vendidos" filas={r.productos.map((p) => ({ nombre: p.nombre, valor: p.importe, detalle: `${formatoCantidad(p.cantidad)} ${p.unidad}` }))} />
        <Ranking titulo="Mejores clientes" filas={r.clientes.map((c) => ({ nombre: c.nombre, valor: c.total, detalle: ventas(c.ventas), href: c.id ? `/clientes/${c.id}` : undefined }))} />
        <Ranking titulo="Por vendedor" filas={r.porVendedor.map((v) => ({ nombre: v.nombre, valor: v.total, detalle: ventas(v.ventas) }))} />
        <Ranking titulo="Por categoría" filas={r.categorias.map((c) => ({ nombre: c.nombre, valor: c.importe }))} />
        <Ranking titulo="Cobros por forma de pago" filas={r.porMetodo.map((m) => ({ nombre: ETIQUETA_METODO[m.metodo as Metodo] ?? m.metodo, valor: m.total, detalle: `${m.pagos} ${m.pagos === 1 ? "pago" : "pagos"}` }))} />
        {r.porSucursal.length > 1 && <Ranking titulo="Por sucursal" filas={r.porSucursal.map((s) => ({ nombre: s.nombre, valor: s.total, detalle: ventas(s.ventas) }))} />}
        <Ranking
          titulo="Gastos de caja"
          descripcion={gastos ? `Total ${formatoMoneda(gastos)}` : undefined}
          filas={r.gastos.map((g) => ({ nombre: g.categoria, valor: g.total }))}
          tono="mal"
        />
      </div>
    </div>
  );
}

function Kpi({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: string; detalle?: string; tono?: "bien" | "mal" }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{etiqueta}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{valor}</CardTitle>
        {detalle && <CardDescription className={tono === "bien" ? "text-emerald-700" : tono === "mal" ? "text-destructive" : undefined}>{detalle}</CardDescription>}
      </CardHeader>
    </Card>
  );
}

function Ranking({
  titulo,
  descripcion,
  filas,
  tono,
}: {
  titulo: string;
  descripcion?: string;
  filas: { nombre: string; valor: number; detalle?: string; href?: string }[];
  tono?: "mal";
}) {
  const maximo = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        {descripcion && <CardDescription>{descripcion}</CardDescription>}
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin movimientos en el periodo.</p>
        ) : (
          <ul className="grid gap-2.5">
            {filas.slice(0, 10).map((f, i) => (
              <li key={`${f.nombre}-${i}`} className="grid gap-1 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {f.href ? (
                      <Link href={f.href} className="hover:underline">
                        {f.nombre}
                      </Link>
                    ) : (
                      f.nombre
                    )}
                    {f.detalle && <span className="text-muted-foreground ml-1.5 text-xs">{f.detalle}</span>}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{formatoMoneda(f.valor)}</span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div className={`h-full rounded-full ${tono === "mal" ? "bg-destructive/70" : "bg-primary/70"}`} style={{ width: `${(f.valor / maximo) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
