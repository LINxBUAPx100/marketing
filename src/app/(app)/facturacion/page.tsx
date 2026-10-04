import { and, desc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Buscador } from "@/components/buscador";
import { Encabezado } from "@/components/encabezado";
import { FiltroSelect } from "@/components/filtro-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { ambientePac } from "@/lib/facturacion/pac";
import { esFecha, hoyEnMexico, rangoDeDias } from "@/lib/fechas";
import { formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { DialogoGlobal } from "./global";

export const metadata: Metadata = { title: "Facturación" };

export default async function PaginaFacturacion({ searchParams }: PageProps<"/facturacion">) {
  const sesion = await requerirPermiso("facturacion.ver");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const hoy = hoyEnMexico();
  const desde = esFecha(sp.desde) ? sp.desde : `${hoy.slice(0, 8)}01`;
  const hasta = esFecha(sp.hasta) ? sp.hasta : hoy;
  const rango = rangoDeDias(desde, hasta);
  const misSucursales = sesion.sucursales.map((s) => s.id);
  const ambiente = ambientePac();

  const filtros = [eq(t.factura.negocioId, sesion.negocio.id), inArray(t.factura.sucursalId, misSucursales.length ? misSucursales : ["00000000-0000-0000-0000-000000000000"]), gte(t.factura.creadoEn, rango.inicio), lt(t.factura.creadoEn, rango.fin)];
  if (sp.tipo === "P") filtros.push(eq(t.factura.tipo, "P"));
  else if (sp.tipo !== "todas") filtros.push(eq(t.factura.tipo, "I"));
  if (sp.estado === "canceladas") filtros.push(eq(t.factura.estado, "cancelada"));
  if (sp.q?.trim()) {
    const patron = `%${sp.q.trim()}%`;
    filtros.push(or(ilike(t.factura.uuid, patron), ilike(t.cliente.nombre, patron), ilike(t.cliente.rfc, patron))!);
  }

  const facturas = await db
    .select({ factura: t.factura, cliente: t.cliente.nombre })
    .from(t.factura)
    .leftJoin(t.cliente, eq(t.cliente.id, t.factura.clienteId))
    .where(and(...filtros))
    .orderBy(desc(t.factura.creadoEn))
    .limit(300);
  const vigentes = facturas.filter((f) => f.factura.estado === "vigente" && f.factura.tipo === "I");
  const facturado = vigentes.reduce((s, f) => s + f.factura.total, 0);

  return (
    <>
      <Encabezado titulo="Facturación" descripcion={`CFDI 4.0 · ${formatoMoneda(facturado)} facturado en el periodo (${vigentes.length} facturas vigentes).`}>
        {sesion.puede("facturacion.timbrar") && sesion.sucursal && <DialogoGlobal hoy={hoy} sucursal={sesion.sucursal.nombre} />}
        {sesion.puede("facturacion.timbrar") && (
          <Button nativeButton={false} render={<Link href="/facturacion/nueva" />}>
            <FilePlus2 /> Facturar ventas
          </Button>
        )}
      </Encabezado>

      <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${ambiente.real ? "border-emerald-600/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/10 text-amber-900"}`}>
        <p className="font-medium">{ambiente.nombre}</p>
        <p>{ambiente.descripcion}</p>
        {!process.env.FACTURAPI_KEY && <p className="mt-1 text-xs">Para timbrar de verdad: contrata Facturapi, sube el CSD de la imprenta en su panel y pon la llave en la variable FACTURAPI_KEY del servidor.</p>}
      </div>

      <Buscador placeholder="Buscar por UUID, cliente o RFC" valor={sp.q}>
        <Input type="date" name="desde" defaultValue={desde} key={`d${desde}`} className="h-9 w-auto" aria-label="Desde" />
        <Input type="date" name="hasta" defaultValue={hasta} key={`h${hasta}`} className="h-9 w-auto" aria-label="Hasta" />
        <FiltroSelect nombre="tipo" valor={sp.tipo} etiqueta="Tipo">
          <option value="">Facturas</option>
          <option value="P">Complementos de pago</option>
          <option value="todas">Todo</option>
        </FiltroSelect>
        <FiltroSelect nombre="estado" valor={sp.estado} etiqueta="Estado">
          <option value="">Todas</option>
          <option value="canceladas">Canceladas</option>
        </FiltroSelect>
        <Button type="submit" variant="outline" className="h-9">
          Filtrar
        </Button>
      </Buscador>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Receptor</TableHead>
              <TableHead className="hidden md:table-cell">Fecha</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {facturas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-12 text-center">
                  No hay comprobantes en este periodo.
                </TableCell>
              </TableRow>
            )}
            {facturas.map(({ factura: f, cliente }) => {
              const receptor = f.receptor as { nombre: string; rfc: string };
              return (
                <TableRow key={f.id} className={f.estado === "cancelada" ? "opacity-55" : undefined}>
                  <TableCell>
                    <Link href={`/facturacion/${f.id}`} className="font-mono text-sm font-medium hover:underline">
                      {f.serie}-{f.folio}
                    </Link>
                    <span className="text-muted-foreground block text-xs">
                      {f.tipo === "P" ? "Complemento de pago" : f.global ? "Global" : f.metodoPago}
                      {f.simulada && " · simulada"}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-56">
                    <span className="block truncate">{cliente ?? receptor.nombre}</span>
                    <span className="text-muted-foreground font-mono text-xs">{receptor.rfc}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">{formatoFechaHora(f.creadoEn)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{f.tipo === "P" ? "—" : formatoMoneda(f.total)}</TableCell>
                  <TableCell>
                    <Badge variant={f.estado === "vigente" ? "secondary" : "outline"}>{f.estado === "vigente" ? "Vigente" : "Cancelada"}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
