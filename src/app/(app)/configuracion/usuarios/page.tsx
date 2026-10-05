import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { BotonExcel } from "@/components/boton-excel";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoFechaHora, formatoPorcentaje } from "@/lib/numeros";
import { DialogoUsuario } from "./dialogo";

export const metadata: Metadata = { title: "Usuarios" };

export default async function PaginaUsuarios() {
  const sesion = await requerirPermiso("usuarios.ver");
  const puedeEditar = sesion.puede("usuarios.editar");
  const negocioId = sesion.negocio.id;

  const [usuarios, roles, sucursales, asignaciones] = await Promise.all([
    db
      .select({
        id: t.usuario.id,
        nombre: t.usuario.nombre,
        correo: t.usuario.correo,
        telefono: t.usuario.telefono,
        rolId: t.usuario.rolId,
        rol: t.rol.nombre,
        esAdmin: t.rol.esAdmin,
        comisionBp: t.usuario.comisionBp,
        activo: t.usuario.activo,
        ultimoAcceso: t.usuario.ultimoAcceso,
      })
      .from(t.usuario)
      .innerJoin(t.rol, eq(t.rol.id, t.usuario.rolId))
      .where(eq(t.usuario.negocioId, negocioId))
      .orderBy(asc(t.usuario.nombre)),
    db.select({ id: t.rol.id, nombre: t.rol.nombre }).from(t.rol).where(eq(t.rol.negocioId, negocioId)).orderBy(asc(t.rol.creadoEn)),
    db.select({ id: t.sucursal.id, nombre: t.sucursal.nombre }).from(t.sucursal).where(eq(t.sucursal.negocioId, negocioId)).orderBy(asc(t.sucursal.creadoEn)),
    db.select().from(t.usuarioSucursal),
  ]);

  const sucursalesDe = (usuarioId: string) =>
    asignaciones.filter((a) => a.usuarioId === usuarioId).map((a) => a.sucursalId);
  const nombreSucursal = new Map(sucursales.map((s) => [s.id, s.nombre]));

  return (
    <>
      <Encabezado titulo="Usuarios" descripcion="Usuarios ilimitados. Cada uno entra con su correo y ve lo que su rol permite.">
        <BotonExcel catalogo="usuarios" />
        {puedeEditar && <DialogoUsuario roles={roles} sucursales={sucursales} />}
      </Encabezado>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="hidden md:table-cell">Sucursales</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Comisión</TableHead>
              <TableHead className="hidden lg:table-cell">Último acceso</TableHead>
              {puedeEditar && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => {
              const asignadas = sucursalesDe(u.id);
              return (
                <TableRow key={u.id} className={u.activo ? undefined : "opacity-55"}>
                  <TableCell>
                    <p className="font-medium">
                      {u.nombre} {!u.activo && <Badge variant="outline">Inactivo</Badge>}
                    </p>
                    <p className="text-muted-foreground text-xs">{u.correo}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.esAdmin ? "default" : "secondary"}>{u.rol}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-56 truncate md:table-cell">
                    {u.esAdmin ? "Todas" : asignadas.map((id) => nombreSucursal.get(id)).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {u.comisionBp ? formatoPorcentaje(u.comisionBp) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden lg:table-cell">{formatoFechaHora(u.ultimoAcceso)}</TableCell>
                  {puedeEditar && (
                    <TableCell>
                      <DialogoUsuario
                        roles={roles}
                        sucursales={sucursales}
                        usuario={{
                          id: u.id,
                          nombre: u.nombre,
                          correo: u.correo,
                          telefono: u.telefono ?? "",
                          rolId: u.rolId,
                          comision: String(u.comisionBp / 100),
                          activo: u.activo,
                          sucursales: asignadas,
                        }}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
