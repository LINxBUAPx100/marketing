import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Buscador } from "@/components/buscador";
import { Encabezado } from "@/components/encabezado";
import { FiltroSelect } from "@/components/filtro-select";
import { TablaVentas } from "@/components/tabla-ventas";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { esFecha, hoyEnMexico, rangoDeDias } from "@/lib/fechas";
import { formatoMoneda } from "@/lib/numeros";

export const metadata: Metadata = { title: "Ventas" };

export default async function PaginaVentas({ searchParams }: PageProps<"/ventas">) {
  const sesion = await requerirPermiso("ventas.ver");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const hoy = hoyEnMexico();
  const desde = esFecha(sp.desde) ? sp.desde : hoy;
  const hasta = esFecha(sp.hasta) ? sp.hasta : hoy;
  const rango = rangoDeDias(desde, hasta);
  const misSucursales = sesion.sucursales.map((s) => s.id);
  const sucursal = sp.sucursal && misSucursales.includes(sp.sucursal) ? sp.sucursal : null;

  const filtros = [
    eq(t.venta.negocioId, sesion.negocio.id),
    inArray(t.venta.sucursalId, sucursal ? [sucursal] : misSucursales.length ? misSucursales : ["00000000-0000-0000-0000-000000000000"]),
    gte(t.venta.creadoEn, rango.inicio),
    lt(t.venta.creadoEn, rango.fin),
  ];
  if (sp.q?.trim()) {
    const patron = `%${sp.q.trim()}%`;
    filtros.push(or(ilike(t.venta.folio, patron), ilike(t.cliente.nombre, patron), ilike(t.cliente.empresa, patron))!);
  }
  if (sp.estado === "canceladas") filtros.push(eq(t.venta.estado, "cancelada"));
  else if (sp.estado === "por-cobrar") filtros.push(eq(t.venta.estado, "activa"), sql`${t.venta.pagado} < ${t.venta.total}`);
  else if (sp.estado === "pagadas") filtros.push(eq(t.venta.estado, "activa"), sql`${t.venta.pagado} >= ${t.venta.total}`);
  else if (sp.estado !== "todas") filtros.push(eq(t.venta.estado, "activa"));

  const ventas = await db
    .select({
      id: t.venta.id,
      folio: t.venta.folio,
      creadoEn: t.venta.creadoEn,
      total: t.venta.total,
      pagado: t.venta.pagado,
      estado: t.venta.estado,
      cliente: t.cliente.nombre,
      vendedor: t.usuario.nombre,
      sucursal: t.sucursal.nombre,
    })
    .from(t.venta)
    .leftJoin(t.cliente, eq(t.cliente.id, t.venta.clienteId))
    .innerJoin(t.usuario, eq(t.usuario.id, t.venta.usuarioId))
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.venta.sucursalId))
    .where(and(...filtros))
    .orderBy(desc(t.venta.creadoEn))
    .limit(500);

  const activas = ventas.filter((v) => v.estado === "activa");
  const vendido = activas.reduce((s, v) => s + v.total, 0);
  const porCobrar = activas.reduce((s, v) => s + v.total - v.pagado, 0);

  return (
    <>
      <Encabezado titulo="Ventas" descripcion={desde === hasta ? (desde === hoy ? "Ventas de hoy." : `Ventas del ${desde}.`) : `Del ${desde} al ${hasta}.`}>
        {sesion.puede("ventas.crear") && (
          <Button nativeButton={false} render={<Link href="/ventas/nueva" />}>
            <Plus /> Nueva venta
          </Button>
        )}
      </Encabezado>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Resumen etiqueta="Ventas" valor={String(activas.length)} />
        <Resumen etiqueta="Vendido" valor={formatoMoneda(vendido)} />
        <Resumen etiqueta="Por cobrar de estas ventas" valor={formatoMoneda(porCobrar)} alerta={porCobrar > 0} />
      </div>

      <Buscador placeholder="Buscar por folio o cliente" valor={sp.q}>
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Del</span>
          <Input key={desde} type="date" name="desde" defaultValue={desde} className="h-9 w-auto" />
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">al</span>
          <Input key={hasta} type="date" name="hasta" defaultValue={hasta} className="h-9 w-auto" />
        </label>
        <FiltroSelect nombre="estado" valor={sp.estado} etiqueta="Estado">
          <option value="">Vigentes</option>
          <option value="por-cobrar">Por cobrar</option>
          <option value="pagadas">Pagadas</option>
          <option value="canceladas">Canceladas</option>
          <option value="todas">Todas</option>
        </FiltroSelect>
        {sesion.sucursales.length > 1 && (
          <FiltroSelect nombre="sucursal" valor={sucursal ?? ""} etiqueta="Sucursal">
            <option value="">Todas mis sucursales</option>
            {sesion.sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </FiltroSelect>
        )}
        <Button type="submit" variant="outline" className="h-9">
          Filtrar
        </Button>
      </Buscador>

      <Card className="py-0">
        <TablaVentas ventas={ventas} vacio="No hay ventas con estos filtros." />
      </Card>
    </>
  );
}

function Resumen({ etiqueta, valor, alerta }: { etiqueta: string; valor: string; alerta?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{etiqueta}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${alerta ? "text-destructive" : ""}`}>{valor}</CardTitle>
      </CardHeader>
    </Card>
  );
}
