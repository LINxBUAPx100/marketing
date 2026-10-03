import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoFechaHora } from "@/lib/numeros";

export const metadata: Metadata = { title: "Bitácora" };

const ACCIONES: Record<string, string> = { crear: "Creó", editar: "Editó", cancelar: "Canceló" };
const ENTIDADES: Record<string, string> = {
  negocio: "datos del negocio",
  sucursal: "sucursal",
  usuario: "usuario",
  rol: "rol",
};

export default async function PaginaBitacora() {
  const sesion = await requerirPermiso("bitacora.ver");
  const registros = await db
    .select({
      id: t.bitacora.id,
      accion: t.bitacora.accion,
      entidad: t.bitacora.entidad,
      detalle: t.bitacora.detalle,
      creadoEn: t.bitacora.creadoEn,
      usuario: t.usuario.nombre,
      sucursal: t.sucursal.nombre,
    })
    .from(t.bitacora)
    .leftJoin(t.usuario, eq(t.usuario.id, t.bitacora.usuarioId))
    .leftJoin(t.sucursal, eq(t.sucursal.id, t.bitacora.sucursalId))
    .where(eq(t.bitacora.negocioId, sesion.negocio.id))
    .orderBy(desc(t.bitacora.creadoEn))
    .limit(200);

  return (
    <>
      <Encabezado titulo="Bitácora" descripcion="Quién hizo cada cambio, en qué sucursal y cuándo. Se muestran los últimos 200." />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead className="hidden md:table-cell">Detalle</TableHead>
              <TableHead className="hidden sm:table-cell">Sucursal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  Aquí aparecerá cada cambio que se haga en el sistema.
                </TableCell>
              </TableRow>
            )}
            {registros.map((r) => {
              const detalle = (r.detalle ?? {}) as Record<string, unknown>;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">{formatoFechaHora(r.creadoEn)}</TableCell>
                  <TableCell>{r.usuario ?? "Sistema"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ACCIONES[r.accion] ?? r.accion}</Badge>{" "}
                    <span className="text-sm">{ENTIDADES[r.entidad] ?? r.entidad}</span>
                    {typeof detalle.nombre === "string" && <span className="font-medium"> {detalle.nombre}</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-72 truncate font-mono text-xs md:table-cell">
                    {Object.entries(detalle)
                      .filter(([k]) => k !== "nombre")
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(" · ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">{r.sucursal ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
