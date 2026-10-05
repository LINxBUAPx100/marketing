import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { DialogoSucursal } from "./dialogo";

export const metadata: Metadata = { title: "Sucursales" };

export default async function PaginaSucursales() {
  const sesion = await requerirPermiso("sucursales.ver");
  const puedeEditar = sesion.puede("sucursales.editar");
  const sucursales = await db
    .select()
    .from(t.sucursal)
    .where(eq(t.sucursal.negocioId, sesion.negocio.id))
    .orderBy(asc(t.sucursal.creadoEn));

  return (
    <>
      <Encabezado titulo="Sucursales" descripcion="Cada sucursal lleva su propia caja, inventario y folios.">
        {puedeEditar && <DialogoSucursal />}
      </Encabezado>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sucursal</TableHead>
              <TableHead>Prefijo de folio</TableHead>
              <TableHead className="hidden md:table-cell">Dirección</TableHead>
              <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              {puedeEditar && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sucursales.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.nombre}</TableCell>
                <TableCell className="font-mono text-xs">{s.prefijoFolio}-0001</TableCell>
                <TableCell className="text-muted-foreground hidden max-w-64 truncate md:table-cell">{s.direccion ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{s.telefono ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.activa ? "secondary" : "outline"}>{s.activa ? "Activa" : "Inactiva"}</Badge>
                </TableCell>
                {puedeEditar && (
                  <TableCell>
                    <DialogoSucursal
                      sucursal={{
                        id: s.id,
                        nombre: s.nombre,
                        prefijoFolio: s.prefijoFolio,
                        direccion: s.direccion ?? "",
                        telefono: s.telefono ?? "",
                        activa: s.activa,
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
