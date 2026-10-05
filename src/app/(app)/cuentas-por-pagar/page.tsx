import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Plus, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { EstadoCxP } from "@/components/estado-cxp";
import { FiltroSelect } from "@/components/filtro-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { estadoCuentaPorPagar } from "@/lib/almacen/reglas";
import { requerirPermiso } from "@/lib/auth";
import { formatoFecha, formatoMoneda } from "@/lib/numeros";

export const metadata: Metadata = { title: "Cuentas por pagar" };

export default async function PaginaCuentasPorPagar({ searchParams }: PageProps<"/cuentas-por-pagar">) {
  const sesion = await requerirPermiso("cxp.ver");
  const { ver } = (await searchParams) as Record<string, string | undefined>;
  const misSucursales = sesion.sucursales.map((s) => s.id);
  if (!misSucursales.length) return <Encabezado titulo="Cuentas por pagar" descripcion="No tienes sucursales asignadas." />;

  const filtros = [eq(t.compra.negocioId, sesion.negocio.id), inArray(t.compra.sucursalId, misSucursales)];
  if (ver !== "todas") filtros.push(eq(t.compra.estado, "activa"), sql`${t.compra.pagado} < ${t.compra.total}`);

  const compras = await db
    .select({
      id: t.compra.id,
      fecha: t.compra.fecha,
      vencimiento: t.compra.vencimiento,
      referencia: t.compra.referencia,
      total: t.compra.total,
      pagado: t.compra.pagado,
      estado: t.compra.estado,
      proveedorId: t.proveedor.id,
      proveedor: t.proveedor.nombre,
      sucursal: t.sucursal.nombre,
    })
    .from(t.compra)
    .innerJoin(t.proveedor, eq(t.proveedor.id, t.compra.proveedorId))
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.compra.sucursalId))
    .where(and(...filtros))
    .orderBy(ver === "todas" ? desc(t.compra.fecha) : asc(t.compra.vencimiento))
    .limit(300);

  const pendientes = compras.filter((c) => c.estado === "activa" && c.pagado < c.total);
  const deuda = pendientes.reduce((s, c) => s + c.total - c.pagado, 0);
  const vencido = pendientes.filter((c) => estadoCuentaPorPagar(c) === "vencida").reduce((s, c) => s + c.total - c.pagado, 0);
  const semana = pendientes.filter((c) => estadoCuentaPorPagar(c) === "por-vencer").reduce((s, c) => s + c.total - c.pagado, 0);

  // Deuda por proveedor, de mayor a menor.
  const porProveedor = new Map<string, { id: string; nombre: string; saldo: number }>();
  for (const c of pendientes) {
    const p = porProveedor.get(c.proveedorId) ?? { id: c.proveedorId, nombre: c.proveedor, saldo: 0 };
    p.saldo += c.total - c.pagado;
    porProveedor.set(c.proveedorId, p);
  }

  return (
    <>
      <Encabezado titulo="Cuentas por pagar" descripcion="Compras a proveedores pendientes de pago, de la que vence primero a la última.">
        <Button variant="outline" nativeButton={false} render={<Link href="/cuentas-por-pagar/proveedores" />}>
          <Truck /> Proveedores
        </Button>
        {sesion.puede("cxp.crear") && (
          <Button nativeButton={false} render={<Link href="/cuentas-por-pagar/compras/nueva" />}>
            <Plus /> Registrar compra
          </Button>
        )}
      </Encabezado>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Resumen etiqueta="Total por pagar" valor={deuda} />
        <Resumen etiqueta="Vencido" valor={vencido} alerta={vencido > 0} />
        <Resumen etiqueta="Vence en 7 días" valor={semana} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="content-start">
          <CardHeader>
            <CardTitle>Por proveedor</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {porProveedor.size === 0 && <li className="text-muted-foreground py-2 text-sm">No se le debe a nadie.</li>}
              {[...porProveedor.values()]
                .sort((a, b) => b.saldo - a.saldo)
                .map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 py-2 text-sm">
                    <span className="truncate font-medium">{p.nombre}</span>
                    <span className="shrink-0 tabular-nums">{formatoMoneda(p.saldo)}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid min-w-0 content-start gap-3">
          <form className="flex justify-end">
            <FiltroSelect nombre="ver" valor={ver} etiqueta="Qué compras ver">
              <option value="">Con saldo pendiente</option>
              <option value="todas">Todas las compras</option>
            </FiltroSelect>
          </form>
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Total</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compras.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-12 text-center">
                      {ver === "todas" ? "Aún no hay compras registradas." : "No hay compras pendientes de pago."}
                    </TableCell>
                  </TableRow>
                )}
                {compras.map((c) => (
                  <TableRow key={c.id} className={c.estado === "cancelada" ? "opacity-55" : undefined}>
                    <TableCell>
                      <Link href={`/cuentas-por-pagar/compras/${c.id}`} className="font-medium hover:underline">
                        {c.proveedor}
                      </Link>
                      <span className="text-muted-foreground block text-xs">{[c.referencia, c.sucursal].filter(Boolean).join(" · ")}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">{formatoFecha(c.fecha)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatoFecha(c.vencimiento)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatoMoneda(c.total)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{c.estado === "activa" ? formatoMoneda(c.total - c.pagado) : "—"}</TableCell>
                    <TableCell>
                      <EstadoCxP compra={c} />
                    </TableCell>
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

function Resumen({ etiqueta, valor, alerta }: { etiqueta: string; valor: number; alerta?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{etiqueta}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${alerta ? "text-destructive" : ""}`}>{formatoMoneda(valor)}</CardTitle>
      </CardHeader>
    </Card>
  );
}
