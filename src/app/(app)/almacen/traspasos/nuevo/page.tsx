import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { db, t } from "@/db";
import { articulosConExistencia } from "@/lib/almacen/consultas";
import { requerirPermiso } from "@/lib/auth";
import { FormularioTraspaso } from "./formulario";

export const metadata: Metadata = { title: "Nuevo traspaso" };

export default async function PaginaNuevoTraspaso() {
  const sesion = await requerirPermiso("almacen.traspasar");
  const todas = await db
    .select({ id: t.sucursal.id, nombre: t.sucursal.nombre })
    .from(t.sucursal)
    .where(and(eq(t.sucursal.negocioId, sesion.negocio.id), eq(t.sucursal.activa, true)))
    .orderBy(asc(t.sucursal.creadoEn));
  // Se puede enviar desde las sucursales propias hacia cualquier sucursal del negocio.
  const origenes = sesion.sucursales.map((s) => ({ id: s.id, nombre: s.nombre }));
  const articulosPorSucursal = Object.fromEntries(await Promise.all(origenes.map(async (s) => [s.id, await articulosConExistencia(sesion.negocio.id, s.id)] as const)));

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/almacen/traspasos" />}>
        <ArrowLeft /> Traspasos
      </Button>
      <Encabezado titulo="Nuevo traspaso" descripcion="Lo que sale de una sucursal entra en la otra en el mismo momento." />
      {todas.length < 2 ? (
        <p className="text-muted-foreground">Se necesitan al menos dos sucursales activas.</p>
      ) : (
        <FormularioTraspaso origenes={origenes} destinos={todas} articulosPorSucursal={articulosPorSucursal} origenInicial={sesion.sucursal?.id ?? origenes[0]?.id} />
      )}
    </>
  );
}
