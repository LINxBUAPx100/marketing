import { asc, and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { FormularioProducto } from "../formulario";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function PaginaNuevoProducto() {
  const sesion = await requerirPermiso("productos.crear");
  const categorias = await db
    .select({ id: t.categoria.id, nombre: t.categoria.nombre })
    .from(t.categoria)
    .where(and(eq(t.categoria.negocioId, sesion.negocio.id), eq(t.categoria.activa, true)))
    .orderBy(asc(t.categoria.nombre));

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/productos" />}>
        <ArrowLeft /> Productos
      </Button>
      <Encabezado titulo="Nuevo producto" />
      <FormularioProducto
        categorias={categorias}
        verCostos={sesion.puede("productos.costos")}
        puedeEditar
        sucursal={sesion.sucursal?.nombre ?? null}
        valores={{
          nombre: "",
          codigo: "",
          categoriaId: "",
          descripcion: "",
          tipo: "producto",
          unidad: "pieza",
          precio: "",
          precioRevendedor: "",
          costo: "",
          existenciaMinima: "0",
          activo: true,
          requiereProduccion: false,
          tipoImpresion: "",
          claveSat: "82121500",
          claveUnidad: "H87",
          impresionesPorUnidad: "0",
          imagenUrl: null,
        }}
      />
    </>
  );
}
