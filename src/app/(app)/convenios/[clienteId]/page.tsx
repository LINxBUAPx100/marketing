import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { centavosATexto } from "@/lib/numeros";
import { EditorConvenio } from "./editor";

export const metadata: Metadata = { title: "Convenio" };

const fechaMexico = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d);

export default async function PaginaConvenio({ params }: PageProps<"/convenios/[clienteId]">) {
  const { clienteId } = await params;
  const sesion = await requerirPermiso("convenios.ver");
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) notFound();
  const [cliente] = await db.select().from(t.cliente).where(and(eq(t.cliente.id, clienteId), eq(t.cliente.negocioId, sesion.negocio.id)));
  if (!cliente) notFound();

  const [[convenio], productos] = await Promise.all([
    db.select().from(t.convenio).where(eq(t.convenio.clienteId, clienteId)),
    db
      .select({ id: t.producto.id, nombre: t.producto.nombre, unidad: t.producto.unidad, precio: t.producto.precio, precioRevendedor: t.producto.precioRevendedor })
      .from(t.producto)
      .where(and(eq(t.producto.negocioId, sesion.negocio.id), eq(t.producto.activo, true)))
      .orderBy(asc(t.producto.nombre)),
  ]);
  const precios = convenio ? await db.select().from(t.convenioPrecio).where(eq(t.convenioPrecio.convenioId, convenio.id)) : [];

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/convenios" />}>
        <ArrowLeft /> Convenios
      </Button>
      <Encabezado
        titulo={`Convenio con ${cliente.nombre}`}
        descripcion={`${cliente.empresa ? `${cliente.empresa} · ` : ""}Precios de ${cliente.tipoPrecio === "revendedor" ? "revendedor" : "público"} como base.${convenio ? "" : " Aún no tiene convenio."}`}
      >
        <Button variant="outline" nativeButton={false} render={<Link href={`/clientes/${cliente.id}`} />}>
          Ver cliente
        </Button>
      </Encabezado>
      <EditorConvenio
        clienteId={cliente.id}
        revendedor={cliente.tipoPrecio === "revendedor"}
        productos={productos}
        puedeEditar={sesion.puede("convenios.editar")}
        inicial={{
          descuento: convenio ? String(convenio.descuentoBp / 100) : "0",
          diasCredito: convenio ? String(convenio.diasCredito) : "15",
          limiteCredito: convenio?.limiteCredito != null ? centavosATexto(convenio.limiteCredito) : "",
          vigenteHasta: convenio?.vigenteHasta ? fechaMexico(convenio.vigenteHasta) : "",
          notas: convenio?.notas ?? "",
          activo: convenio?.activo ?? true,
          precios: precios.map((p) => ({ productoId: p.productoId, precio: p.precio })),
        }}
      />
    </>
  );
}
