import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, Handshake, MessageCircle, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { TablaVentas } from "@/components/tabla-ventas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoMoneda } from "@/lib/numeros";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { DialogoCliente } from "../dialogo";

export const metadata: Metadata = { title: "Cliente" };

export default async function PaginaCliente({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("clientes.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [cliente] = await db
    .select()
    .from(t.cliente)
    .where(and(eq(t.cliente.id, id), eq(t.cliente.negocioId, sesion.negocio.id)));
  if (!cliente) notFound();

  const ventas = await db
    .select({
      id: t.venta.id,
      folio: t.venta.folio,
      creadoEn: t.venta.creadoEn,
      total: t.venta.total,
      pagado: t.venta.pagado,
      estado: t.venta.estado,
      sucursal: t.sucursal.nombre,
    })
    .from(t.venta)
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.venta.sucursalId))
    .where(eq(t.venta.clienteId, id))
    .orderBy(desc(t.venta.creadoEn))
    .limit(100);

  const activas = ventas.filter((v) => v.estado === "activa");
  const saldo = activas.reduce((s, v) => s + v.total - v.pagado, 0);
  const comprado = activas.reduce((s, v) => s + v.total, 0);
  const whatsapp = enlaceWhatsApp(cliente.telefono, `Hola ${cliente.nombre.split(" ")[0]}, te escribimos de ${sesion.negocio.nombre}.`);

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/clientes" />}>
        <ArrowLeft /> Clientes
      </Button>
      <Encabezado titulo={cliente.nombre} descripcion={[cliente.empresa, cliente.telefono, cliente.correo].filter(Boolean).join(" · ") || undefined}>
        {whatsapp && (
          <Button variant="outline" nativeButton={false} render={<a href={whatsapp} target="_blank" rel="noopener noreferrer" />}>
            <MessageCircle /> WhatsApp
          </Button>
        )}
        {sesion.puede("clientes.editar") && (
          <DialogoCliente
            cliente={{
              id: cliente.id,
              nombre: cliente.nombre,
              empresa: cliente.empresa ?? "",
              telefono: cliente.telefono ?? "",
              correo: cliente.correo ?? "",
              tipoPrecio: cliente.tipoPrecio,
              rfc: cliente.rfc ?? "",
              razonSocial: cliente.razonSocial ?? "",
              regimenFiscal: cliente.regimenFiscal ?? "",
              codigoPostal: cliente.codigoPostal ?? "",
              usoCfdi: cliente.usoCfdi ?? "",
              notas: cliente.notas ?? "",
              activo: cliente.activo,
            }}
          />
        )}
        {sesion.puede("convenios.ver") && (
          <Button variant="outline" nativeButton={false} render={<Link href={`/convenios/${cliente.id}`} />}>
            <Handshake /> Convenio
          </Button>
        )}
        {sesion.puede("ventas.crear") && (
          <Button nativeButton={false} render={<Link href={`/ventas/nueva?cliente=${cliente.id}`} />}>
            <ShoppingCart /> Venderle
          </Button>
        )}
      </Encabezado>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Saldo pendiente</CardDescription>
            <CardTitle className={`text-2xl tabular-nums ${saldo > 0 ? "text-destructive" : ""}`}>{formatoMoneda(saldo)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total comprado</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatoMoneda(comprado)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Precios</CardDescription>
            <CardTitle className="text-2xl">{cliente.tipoPrecio === "revendedor" ? "Revendedor" : "Público"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card className="min-w-0 py-0">
          <CardHeader className="pt-4">
            <CardTitle>Compras</CardTitle>
          </CardHeader>
          <TablaVentas ventas={ventas.map((v) => ({ ...v, cliente: cliente.nombre }))} mostrarCliente={false} vacio="Todavía no tiene compras." />
        </Card>
        <Card className="content-start">
          <CardHeader>
            <CardTitle>Datos fiscales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {cliente.rfc ? (
              <>
                <Dato etiqueta="RFC" valor={cliente.rfc} />
                <Dato etiqueta="Razón social" valor={cliente.razonSocial} />
                <Dato etiqueta="Régimen" valor={cliente.regimenFiscal} />
                <Dato etiqueta="C.P." valor={cliente.codigoPostal} />
                <Dato etiqueta="Uso CFDI" valor={cliente.usoCfdi} />
              </>
            ) : (
              <p className="text-muted-foreground">Sin datos para facturar.</p>
            )}
            {cliente.notas && (
              <p className="text-muted-foreground mt-2 border-t pt-3 whitespace-pre-line">{cliente.notas}</p>
            )}
            {!cliente.activo && <Badge variant="outline">Cliente inactivo</Badge>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="text-right font-medium">{valor ?? "—"}</span>
    </div>
  );
}
