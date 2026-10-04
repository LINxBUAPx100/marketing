import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { catalogoParaVender, clientePorId } from "@/lib/ventas/consultas";
import { EditorCotizacion } from "../../editor";

export const metadata: Metadata = { title: "Editar cotización" };

const fechaMexico = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d);

export default async function PaginaEditarCotizacion({ params }: PageProps<"/cotizaciones/[id]/editar">) {
  const { id } = await params;
  const sesion = await requerirPermiso("cotizaciones.editar");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [c] = await db.select().from(t.cotizacion).where(and(eq(t.cotizacion.id, id), eq(t.cotizacion.negocioId, sesion.negocio.id)));
  if (!c) notFound();
  if (c.estado !== "abierta") redirect(`/cotizaciones/${id}`);

  const [{ productos, categorias }, cliente, partidas] = await Promise.all([
    catalogoParaVender(sesion),
    clientePorId(sesion, c.clienteId),
    db.select().from(t.cotizacionPartida).where(eq(t.cotizacionPartida.cotizacionId, id)).orderBy(asc(t.cotizacionPartida.orden)),
  ]);

  return (
    <EditorCotizacion
      productos={productos}
      categorias={categorias}
      iva={{ ivaBp: sesion.negocio.ivaBp, preciosIncluyenIva: sesion.negocio.preciosIncluyenIva }}
      puedeDescontar={sesion.puede("ventas.descuento")}
      puedeCrearCliente={sesion.puede("clientes.crear")}
      inicial={{
        id: c.id,
        folio: c.folio,
        cliente,
        vigenciaHasta: fechaMexico(c.vigenciaHasta),
        notas: c.notas ?? "",
        condiciones: c.condiciones ?? "",
        partidas,
      }}
    />
  );
}
