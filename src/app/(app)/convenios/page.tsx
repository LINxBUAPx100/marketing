import { and, asc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoFecha, formatoMoneda } from "@/lib/numeros";
import { NuevoConvenio } from "./nuevo";

export const metadata: Metadata = { title: "Convenios" };

export default async function PaginaConvenios() {
  const sesion = await requerirPermiso("convenios.ver");
  const negocioId = sesion.negocio.id;

  // Saldo y saldo vencido (ventas más viejas que los días de crédito) de cada cliente con convenio.
  const filas = await db
    .select({
      convenio: t.convenio,
      cliente: t.cliente.nombre,
      empresa: t.cliente.empresa,
      precios: sql<number>`(select count(*) from ${t.convenioPrecio} where ${t.convenioPrecio.convenioId} = ${t.convenio.id})::int`,
      saldo: sql<number>`(select coalesce(sum(${t.venta.total} - ${t.venta.pagado}), 0) from ${t.venta} where ${t.venta.clienteId} = ${t.convenio.clienteId} and ${t.venta.estado} = 'activa')::int`,
      vencido: sql<number>`(select coalesce(sum(${t.venta.total} - ${t.venta.pagado}), 0) from ${t.venta} where ${t.venta.clienteId} = ${t.convenio.clienteId} and ${t.venta.estado} = 'activa' and ${t.venta.creadoEn} + (${t.convenio.diasCredito} * interval '1 day') < now())::int`,
    })
    .from(t.convenio)
    .innerJoin(t.cliente, eq(t.cliente.id, t.convenio.clienteId))
    .where(eq(t.convenio.negocioId, negocioId))
    .orderBy(asc(t.cliente.nombre));
  const sinConvenio = await db
    .select({ id: t.cliente.id, nombre: t.cliente.nombre })
    .from(t.cliente)
    .where(and(eq(t.cliente.negocioId, negocioId), eq(t.cliente.activo, true), sql`not exists (select 1 from ${t.convenio} where ${t.convenio.clienteId} = ${t.cliente.id})`))
    .orderBy(asc(t.cliente.nombre));
  const ahora = new Date();

  return (
    <>
      <Encabezado titulo="Convenios" descripcion="Clientes con precios especiales, descuento, días y límite de crédito.">
        {sesion.puede("convenios.editar") && sinConvenio.length > 0 && <NuevoConvenio clientes={sinConvenio} />}
      </Encabezado>
      {filas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">Aún no hay convenios. Úsalos con empresas, escuelas o revendedores que compran seguido.</CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Condiciones</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Límite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map(({ convenio: c, cliente, empresa, precios, saldo, vencido }) => {
                const vigente = c.activo && (!c.vigenteHasta || c.vigenteHasta >= ahora);
                return (
                  <TableRow key={c.id} className={vigente ? undefined : "opacity-55"}>
                    <TableCell>
                      <Link href={`/convenios/${c.clienteId}`} className="font-medium hover:underline">
                        {cliente}
                      </Link>
                      {empresa && <span className="text-muted-foreground block text-xs">{empresa}</span>}
                      {!vigente && <Badge variant="outline">{c.activo ? `Venció ${formatoFecha(c.vigenteHasta)}` : "Inactivo"}</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                      {[c.descuentoBp ? `${c.descuentoBp / 100} % desc.` : null, precios ? `${precios} precios especiales` : null, c.diasCredito ? `${c.diasCredito} días` : "Contado"].filter(Boolean).join(" · ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatoMoneda(saldo)}
                      {vencido > 0 && <span className="text-destructive block text-xs font-medium">{formatoMoneda(vencido)} vencido</span>}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {c.limiteCredito != null ? (
                        <span className={saldo > c.limiteCredito ? "text-destructive font-medium" : ""}>{formatoMoneda(c.limiteCredito)}</span>
                      ) : (
                        <span className="text-muted-foreground">Sin límite</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
