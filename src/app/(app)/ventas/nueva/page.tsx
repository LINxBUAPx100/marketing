import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { catalogoParaVender, clientePorId } from "@/lib/ventas/consultas";
import { reglasDeCliente } from "@/lib/ventas/reglas-cliente";
import { PuntoDeVenta } from "./punto-de-venta";

export const metadata: Metadata = { title: "Nueva venta" };

export default async function PaginaNuevaVenta({ searchParams }: PageProps<"/ventas/nueva">) {
  const sesion = await requerirPermiso("ventas.crear");
  const { cliente: clienteParam, cotizacion: cotizacionId } = (await searchParams) as Record<string, string | undefined>;
  if (!sesion.sucursal) {
    return <Encabezado titulo="Nueva venta" descripcion="No tienes una sucursal asignada. Pide a la administración que te asigne una." />;
  }

  // Venta a partir de una cotización: trae su cliente y sus partidas.
  let cotizacion = null;
  if (cotizacionId && /^[0-9a-f-]{36}$/i.test(cotizacionId)) {
    const [c] = await db
      .select()
      .from(t.cotizacion)
      .where(and(eq(t.cotizacion.id, cotizacionId), eq(t.cotizacion.negocioId, sesion.negocio.id), eq(t.cotizacion.estado, "abierta")));
    if (!c) notFound();
    const partidas = await db.select().from(t.cotizacionPartida).where(eq(t.cotizacionPartida.cotizacionId, c.id)).orderBy(asc(t.cotizacionPartida.orden));
    cotizacion = { id: c.id, folio: c.folio, clienteId: c.clienteId, notas: c.notas, partidas };
  }

  const [{ productos, categorias }, cliente] = await Promise.all([catalogoParaVender(sesion), clientePorId(sesion, cotizacion?.clienteId ?? clienteParam)]);
  const infoInicial = cliente ? await reglasDeCliente(sesion.negocio.id, cliente.id) : null;

  return (
    <PuntoDeVenta
      sucursal={sesion.sucursal.nombre}
      sucursalId={sesion.sucursal.id}
      productos={productos}
      categorias={categorias}
      clienteInicial={cliente}
      infoInicial={infoInicial}
      iva={{ ivaBp: sesion.negocio.ivaBp, preciosIncluyenIva: sesion.negocio.preciosIncluyenIva }}
      puedeDescontar={sesion.puede("ventas.descuento")}
      puedeCrearCliente={sesion.puede("clientes.crear")}
      cotizacion={cotizacion && { id: cotizacion.id, folio: cotizacion.folio, notas: cotizacion.notas, partidas: cotizacion.partidas }}
    />
  );
}
