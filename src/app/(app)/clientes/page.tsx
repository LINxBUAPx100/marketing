import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Buscador } from "@/components/buscador";
import { Encabezado } from "@/components/encabezado";
import { FiltroSelect } from "@/components/filtro-select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoMoneda } from "@/lib/numeros";
import { DialogoCliente } from "./dialogo";

export const metadata: Metadata = { title: "Clientes" };

export default async function PaginaClientes({ searchParams }: PageProps<"/clientes">) {
  const sesion = await requerirPermiso("clientes.ver");
  const { q, tipo } = (await searchParams) as Record<string, string | undefined>;

  const filtros = [eq(t.cliente.negocioId, sesion.negocio.id), eq(t.cliente.activo, true)];
  if (q?.trim()) {
    const patron = `%${q.trim()}%`;
    filtros.push(or(ilike(t.cliente.nombre, patron), ilike(t.cliente.empresa, patron), ilike(t.cliente.telefono, patron), ilike(t.cliente.rfc, patron))!);
  }
  if (tipo === "publico" || tipo === "revendedor") filtros.push(eq(t.cliente.tipoPrecio, tipo));

  const saldos = db
    .select({
      clienteId: t.venta.clienteId,
      saldo: sql<number>`sum(${t.venta.total} - ${t.venta.pagado})::int`.as("saldo"),
      compras: sql<number>`count(*)::int`.as("compras"),
    })
    .from(t.venta)
    .where(and(eq(t.venta.negocioId, sesion.negocio.id), eq(t.venta.estado, "activa")))
    .groupBy(t.venta.clienteId)
    .as("saldos");

  const clientes = await db
    .select({
      id: t.cliente.id,
      nombre: t.cliente.nombre,
      empresa: t.cliente.empresa,
      telefono: t.cliente.telefono,
      tipoPrecio: t.cliente.tipoPrecio,
      rfc: t.cliente.rfc,
      saldo: saldos.saldo,
      compras: saldos.compras,
    })
    .from(t.cliente)
    .leftJoin(saldos, eq(saldos.clienteId, t.cliente.id))
    .where(and(...filtros))
    .orderBy(asc(t.cliente.nombre))
    .limit(300);

  return (
    <>
      <Encabezado titulo="Clientes" descripcion="Catálogo de clientes con su saldo pendiente.">
        {sesion.puede("clientes.crear") && <DialogoCliente />}
      </Encabezado>
      <Buscador placeholder="Buscar por nombre, empresa, teléfono o RFC" valor={q}>
        <FiltroSelect nombre="tipo" valor={tipo} etiqueta="Tipo de cliente">
          <option value="">Todos</option>
          <option value="publico">Público</option>
          <option value="revendedor">Revendedores</option>
        </FiltroSelect>
      </Buscador>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
              <TableHead className="hidden md:table-cell">Precios</TableHead>
              <TableHead className="hidden text-right md:table-cell">Compras</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-12 text-center">
                  {q ? "Ningún cliente coincide con la búsqueda." : "Aún no hay clientes. Regístralos aquí o al vender."}
                </TableCell>
              </TableRow>
            )}
            {clientes.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                    {c.nombre}
                  </Link>
                  {(c.empresa || c.rfc) && <span className="text-muted-foreground block text-xs">{[c.empresa, c.rfc].filter(Boolean).join(" · ")}</span>}
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{c.telefono ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {c.tipoPrecio === "revendedor" ? <Badge>Revendedor</Badge> : <span className="text-muted-foreground text-sm">Público</span>}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-right tabular-nums md:table-cell">{c.compras ?? 0}</TableCell>
                <TableCell className={`text-right tabular-nums ${c.saldo ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {c.saldo ? formatoMoneda(c.saldo) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
