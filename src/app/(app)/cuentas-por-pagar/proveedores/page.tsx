import { and, asc, eq, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BotonExcel } from "@/components/boton-excel";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoMoneda } from "@/lib/numeros";
import { DialogoProveedor } from "./dialogo";

export const metadata: Metadata = { title: "Proveedores" };

export default async function PaginaProveedores() {
  const sesion = await requerirPermiso("cxp.ver");
  const deuda = db
    .select({ proveedorId: t.compra.proveedorId, saldo: sql<number>`sum(${t.compra.total} - ${t.compra.pagado})::int`.as("saldo") })
    .from(t.compra)
    .where(and(eq(t.compra.negocioId, sesion.negocio.id), eq(t.compra.estado, "activa")))
    .groupBy(t.compra.proveedorId)
    .as("deuda");
  const proveedores = await db
    .select({ proveedor: t.proveedor, saldo: deuda.saldo })
    .from(t.proveedor)
    .leftJoin(deuda, eq(deuda.proveedorId, t.proveedor.id))
    .where(eq(t.proveedor.negocioId, sesion.negocio.id))
    .orderBy(asc(t.proveedor.nombre));
  const puedeEditar = sesion.puede("cxp.crear");

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/cuentas-por-pagar" />}>
        <ArrowLeft /> Cuentas por pagar
      </Button>
      <Encabezado titulo="Proveedores" descripcion="Quién te surte papel, tinta y materiales, y cuánto les debes.">
        <BotonExcel catalogo="proveedores" />
        {puedeEditar && <DialogoProveedor />}
      </Encabezado>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead className="hidden sm:table-cell">Contacto</TableHead>
              <TableHead className="hidden text-right md:table-cell">Crédito</TableHead>
              <TableHead className="text-right">Le debes</TableHead>
              {puedeEditar && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {proveedores.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-12 text-center">
                  Aún no hay proveedores. Regístralos aquí o al capturar una compra.
                </TableCell>
              </TableRow>
            )}
            {proveedores.map(({ proveedor: p, saldo }) => (
              <TableRow key={p.id} className={p.activo ? undefined : "opacity-55"}>
                <TableCell>
                  <span className="font-medium">{p.nombre}</span> {!p.activo && <Badge variant="outline">Inactivo</Badge>}
                  {p.rfc && <span className="text-muted-foreground block text-xs">{p.rfc}</span>}
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{[p.contacto, p.telefono].filter(Boolean).join(" · ") || "—"}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{p.diasCredito ? `${p.diasCredito} días` : "Contado"}</TableCell>
                <TableCell className={`text-right tabular-nums ${saldo ? "font-medium" : "text-muted-foreground"}`}>{saldo ? formatoMoneda(saldo) : "—"}</TableCell>
                {puedeEditar && (
                  <TableCell>
                    <DialogoProveedor
                      proveedor={{
                        id: p.id,
                        nombre: p.nombre,
                        contacto: p.contacto ?? "",
                        telefono: p.telefono ?? "",
                        correo: p.correo ?? "",
                        rfc: p.rfc ?? "",
                        diasCredito: String(p.diasCredito),
                        notas: p.notas ?? "",
                        activo: p.activo,
                      }}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
