import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { TablaVentas } from "@/components/tabla-ventas";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoMoneda } from "@/lib/numeros";

export const metadata: Metadata = { title: "Cuentas por cobrar" };

export default async function PaginaCuentasPorCobrar() {
  const sesion = await requerirPermiso("cxc.ver");
  const misSucursales = sesion.sucursales.map((s) => s.id);
  if (!misSucursales.length) return <Encabezado titulo="Cuentas por cobrar" descripcion="No tienes sucursales asignadas." />;

  const ventas = await db
    .select({
      id: t.venta.id,
      folio: t.venta.folio,
      creadoEn: t.venta.creadoEn,
      fechaEntrega: t.venta.fechaEntrega,
      total: t.venta.total,
      pagado: t.venta.pagado,
      estado: t.venta.estado,
      clienteId: t.venta.clienteId,
      cliente: t.cliente.nombre,
      sucursal: t.sucursal.nombre,
    })
    .from(t.venta)
    .leftJoin(t.cliente, eq(t.cliente.id, t.venta.clienteId))
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.venta.sucursalId))
    .where(
      and(
        eq(t.venta.negocioId, sesion.negocio.id),
        inArray(t.venta.sucursalId, misSucursales),
        eq(t.venta.estado, "activa"),
        sql`${t.venta.pagado} < ${t.venta.total}`,
      ),
    )
    .orderBy(asc(t.venta.creadoEn));

  // Agrupado por cliente, de mayor a menor saldo.
  const porCliente = new Map<string, { id: string | null; nombre: string; saldo: number; ventas: number }>();
  for (const v of ventas) {
    const clave = v.clienteId ?? "publico";
    const actual = porCliente.get(clave) ?? { id: v.clienteId, nombre: v.cliente ?? "Público en general", saldo: 0, ventas: 0 };
    actual.saldo += v.total - v.pagado;
    actual.ventas += 1;
    porCliente.set(clave, actual);
  }
  const clientes = [...porCliente.values()].sort((a, b) => b.saldo - a.saldo);
  const total = clientes.reduce((s, c) => s + c.saldo, 0);

  return (
    <>
      <Encabezado titulo="Cuentas por cobrar" descripcion="Ventas con saldo pendiente, de la más antigua a la más reciente." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total por cobrar</CardDescription>
            <CardTitle className="text-destructive text-2xl tabular-nums">{formatoMoneda(total)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Ventas pendientes</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{ventas.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Clientes que deben</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{clientes.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="content-start">
          <CardHeader>
            <CardTitle>Por cliente</CardTitle>
          </CardHeader>
          <ul className="divide-y px-4 pb-2">
            {clientes.length === 0 && <li className="text-muted-foreground py-4 text-sm">Nadie debe nada.</li>}
            {clientes.map((c) => (
              <li key={c.id ?? "publico"} className="flex items-center justify-between gap-2 py-2 text-sm">
                {c.id ? (
                  <Link href={`/clientes/${c.id}`} className="min-w-0 truncate font-medium hover:underline">
                    {c.nombre}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{c.nombre}</span>
                )}
                <span className="text-destructive shrink-0 font-medium tabular-nums">{formatoMoneda(c.saldo)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="min-w-0 py-0">
          <TablaVentas ventas={ventas} mostrarEntrega vacio="No hay ventas con saldo pendiente." />
        </Card>
      </div>
    </>
  );
}
