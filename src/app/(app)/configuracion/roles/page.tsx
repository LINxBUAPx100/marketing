import { asc, count, eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { TODOS_LOS_PERMISOS } from "@/lib/permisos";
import { DialogoNuevoRol } from "./dialogo-nuevo";

export const metadata: Metadata = { title: "Roles y permisos" };

export default async function PaginaRoles() {
  const sesion = await requerirPermiso("roles.ver");
  const roles = await db
    .select({
      id: t.rol.id,
      nombre: t.rol.nombre,
      descripcion: t.rol.descripcion,
      permisos: t.rol.permisos,
      esAdmin: t.rol.esAdmin,
      usuarios: count(t.usuario.id),
    })
    .from(t.rol)
    .leftJoin(t.usuario, eq(t.usuario.rolId, t.rol.id))
    .where(eq(t.rol.negocioId, sesion.negocio.id))
    .groupBy(t.rol.id)
    .orderBy(asc(t.rol.creadoEn));

  return (
    <>
      <Encabezado titulo="Roles y permisos" descripcion="Un rol define qué puede ver y hacer cada persona. Crea los que necesites.">
        {sesion.puede("roles.editar") && <DialogoNuevoRol />}
      </Encabezado>
      <Card className="divide-y py-0">
        {roles.map((r) => (
          <Link
            key={r.id}
            href={`/configuracion/roles/${r.id}`}
            className="hover:bg-muted/50 focus-visible:bg-muted/50 flex items-center gap-4 px-4 py-3 outline-none"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.nombre}</p>
              <p className="text-muted-foreground truncate text-sm">{r.descripcion ?? "Sin descripción"}</p>
            </div>
            <Badge variant="outline" className="hidden sm:inline-flex">
              {r.esAdmin ? "Todos los permisos" : `${r.permisos.length} de ${TODOS_LOS_PERMISOS.length} permisos`}
            </Badge>
            <span className="text-muted-foreground w-24 text-right text-sm tabular-nums">
              {r.usuarios} {r.usuarios === 1 ? "usuario" : "usuarios"}
            </span>
            <ChevronRight className="text-muted-foreground size-4" />
          </Link>
        ))}
      </Card>
    </>
  );
}
