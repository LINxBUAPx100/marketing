import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { DialogoFacturar } from "@/components/facturacion/dialogo-facturar";
import { FiltroSelect } from "@/components/filtro-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { datosParaFacturar } from "@/lib/facturacion/consultas";
import { formatoFechaHora, formatoMoneda } from "@/lib/numeros";

export const metadata: Metadata = { title: "Facturar ventas" };

export default async function PaginaFacturarVentas({ searchParams }: PageProps<"/facturacion/nueva">) {
  const sesion = await requerirPermiso("facturacion.timbrar");
  const sp = (await searchParams) as Record<string, string | string[] | undefined>;
  const clienteId = typeof sp.cliente === "string" && /^[0-9a-f-]{36}$/i.test(sp.cliente) ? sp.cliente : null;
  const elegidas = (Array.isArray(sp.venta) ? sp.venta : sp.venta ? [sp.venta] : []).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  const negocioId = sesion.negocio.id;

  // Clientes con datos fiscales y ventas sin factura.
  const sinFactura = sql`not exists (select 1 from ${t.facturaVenta} fv join ${t.factura} f on f.id = fv.factura_id where fv.venta_id = ${t.venta.id} and f.estado = 'vigente' and f.tipo = 'I')`;
  const clientes = await db
    .selectDistinct({ id: t.cliente.id, nombre: t.cliente.nombre })
    .from(t.cliente)
    .innerJoin(t.venta, eq(t.venta.clienteId, t.cliente.id))
    .where(and(eq(t.cliente.negocioId, negocioId), isNotNull(t.cliente.rfc), eq(t.venta.estado, "activa"), sinFactura))
    .orderBy(asc(t.cliente.nombre));

  const ventas = clienteId
    ? await db
        .select({ id: t.venta.id, folio: t.venta.folio, total: t.venta.total, pagado: t.venta.pagado, creadoEn: t.venta.creadoEn })
        .from(t.venta)
        .where(and(eq(t.venta.clienteId, clienteId), eq(t.venta.negocioId, negocioId), eq(t.venta.estado, "activa"), sinFactura))
        .orderBy(asc(t.venta.creadoEn))
    : [];
  const validas = elegidas.filter((id) => ventas.some((v) => v.id === id));
  const datos = validas.length ? await datosParaFacturar(sesion, validas) : null;

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/facturacion" />}>
        <ArrowLeft /> Facturación
      </Button>
      <Encabezado titulo="Facturar ventas" descripcion="Junta en una factura varias ventas del mismo cliente. Solo aparecen clientes con RFC y ventas sin facturar." />

      <form className="mb-4">
        <FiltroSelect nombre="cliente" valor={clienteId ?? ""} etiqueta="Cliente">
          <option value="">Elige el cliente…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </FiltroSelect>
      </form>

      {clienteId && (
        <Card className="max-w-2xl">
          <CardContent>
            {ventas.length === 0 ? (
              <p className="text-muted-foreground text-sm">Este cliente no tiene ventas pendientes de facturar.</p>
            ) : (
              <form className="grid gap-3">
                <input type="hidden" name="cliente" value={clienteId} />
                <ul className="divide-y rounded-lg border">
                  {ventas.map((v) => (
                    <li key={v.id}>
                      <label className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2 text-sm">
                        <input type="checkbox" name="venta" value={v.id} defaultChecked={validas.includes(v.id)} className="accent-primary size-4" />
                        <span className="font-mono font-medium">{v.folio}</span>
                        <span className="text-muted-foreground flex-1">{formatoFechaHora(v.creadoEn)}</span>
                        {v.pagado < v.total && <span className="text-xs text-amber-700">saldo {formatoMoneda(v.total - v.pagado)}</span>}
                        <span className="tabular-nums">{formatoMoneda(v.total)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" variant="outline">
                    Usar estas ventas
                  </Button>
                  {datos && <DialogoFacturar datos={datos} disparador={<Button type="button">Facturar {validas.length} {validas.length === 1 ? "venta" : "ventas"} · {formatoMoneda(datos.total)}</Button>} />}
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
