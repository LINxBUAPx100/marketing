import { and, asc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { Encabezado } from "@/components/encabezado";
import { db, t } from "@/db";
import { urlArchivo } from "@/lib/archivos";
import { requerirPermiso } from "@/lib/auth";
import { PuntoDeVenta } from "./punto-de-venta";

export const metadata: Metadata = { title: "Nueva venta" };

export default async function PaginaNuevaVenta({ searchParams }: PageProps<"/ventas/nueva">) {
  const sesion = await requerirPermiso("ventas.crear");
  const { cliente: clienteId } = (await searchParams) as Record<string, string | undefined>;
  const negocioId = sesion.negocio.id;
  const sucursalId = sesion.sucursal?.id ?? null;

  const [productos, categorias, clientes] = await Promise.all([
    db
      .select({
        id: t.producto.id,
        nombre: t.producto.nombre,
        codigo: t.producto.codigo,
        tipo: t.producto.tipo,
        unidad: t.producto.unidad,
        precio: t.producto.precio,
        precioRevendedor: t.producto.precioRevendedor,
        imagen: t.producto.imagen,
        categoriaId: t.producto.categoriaId,
        existencia: sql<number | null>`${t.existencia.cantidad}::float`,
      })
      .from(t.producto)
      .leftJoin(t.existencia, and(eq(t.existencia.productoId, t.producto.id), sucursalId ? eq(t.existencia.sucursalId, sucursalId) : sql`false`))
      .where(and(eq(t.producto.negocioId, negocioId), eq(t.producto.activo, true)))
      .orderBy(asc(t.producto.nombre)),
    db
      .select({ id: t.categoria.id, nombre: t.categoria.nombre })
      .from(t.categoria)
      .where(and(eq(t.categoria.negocioId, negocioId), eq(t.categoria.activa, true)))
      .orderBy(asc(t.categoria.nombre)),
    clienteId && /^[0-9a-f-]{36}$/i.test(clienteId)
      ? db
          .select({ id: t.cliente.id, nombre: t.cliente.nombre, empresa: t.cliente.empresa, telefono: t.cliente.telefono, tipoPrecio: t.cliente.tipoPrecio })
          .from(t.cliente)
          .where(and(eq(t.cliente.id, clienteId), eq(t.cliente.negocioId, negocioId)))
      : Promise.resolve([]),
  ]);

  if (!sesion.sucursal) {
    return <Encabezado titulo="Nueva venta" descripcion="No tienes una sucursal asignada. Pide a la administración que te asigne una." />;
  }

  return (
    <PuntoDeVenta
      sucursal={sesion.sucursal.nombre}
      productos={productos.map((p) => ({ ...p, imagen: urlArchivo(p.imagen) }))}
      categorias={categorias}
      clienteInicial={clientes[0] ?? null}
      iva={{ ivaBp: sesion.negocio.ivaBp, preciosIncluyenIva: sesion.negocio.preciosIncluyenIva }}
      puedeDescontar={sesion.puede("ventas.descuento")}
      puedeCrearCliente={sesion.puede("clientes.crear")}
    />
  );
}
