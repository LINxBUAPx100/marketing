import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { FormularioRol } from "./formulario";

export const metadata: Metadata = { title: "Permisos del rol" };

export default async function PaginaRol({ params }: PageProps<"/configuracion/roles/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("roles.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [rol] = await db
    .select()
    .from(t.rol)
    .where(and(eq(t.rol.id, id), eq(t.rol.negocioId, sesion.negocio.id)));
  if (!rol) notFound();

  const soloLectura = rol.esAdmin || !sesion.puede("roles.editar");

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/configuracion/roles" />}>
        <ArrowLeft /> Roles
      </Button>
      <Encabezado
        titulo={rol.nombre}
        descripcion={rol.esAdmin ? "El rol Administrador tiene todos los permisos y no se puede modificar." : "Marca lo que pueden hacer las personas con este rol."}
      />
      <FormularioRol
        rol={{ id: rol.id, nombre: rol.nombre, descripcion: rol.descripcion ?? "", permisos: rol.permisos, esAdmin: rol.esAdmin }}
        soloLectura={soloLectura}
      />
    </>
  );
}
