import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { PLANTILLAS, type ClavePlantilla, plantilla } from "@/lib/mensajes/plantillas";
import { whatsappConfigurado } from "@/lib/mensajes/proveedor";
import { formatoFechaHora } from "@/lib/numeros";
import { AvisosAutomaticos, BotonReintentar } from "./controles";

export const metadata: Metadata = { title: "WhatsApp" };

const ESTADO = {
  enviado: { texto: "Enviado", variante: "default" },
  fallido: { texto: "Falló", variante: "destructive" },
  simulado: { texto: "Simulado", variante: "outline" },
} as const;

const ENLACE: Record<string, string> = { venta: "/ventas", factura: "/facturacion", cotizacion: "/cotizaciones", cliente: "/clientes" };

export default async function PaginaWhatsApp() {
  const sesion = await requerirPermiso("negocio.ver");
  const conectado = whatsappConfigurado();
  const mensajes = await db
    .select({ m: t.mensajeWhatsapp, cliente: t.cliente.nombre })
    .from(t.mensajeWhatsapp)
    .leftJoin(t.cliente, eq(t.cliente.id, t.mensajeWhatsapp.clienteId))
    .where(eq(t.mensajeWhatsapp.negocioId, sesion.negocio.id))
    .orderBy(desc(t.mensajeWhatsapp.creadoEn))
    .limit(50);
  const puedeEditar = sesion.puede("negocio.editar");

  return (
    <>
      <Encabezado titulo="WhatsApp" descripcion="Avisos a clientes desde el número del negocio con la API oficial de WhatsApp (Meta)." />

      <div
        className={`mb-6 rounded-xl border px-4 py-3 text-sm ${conectado ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900" : "border-amber-500/40 bg-amber-500/10 text-amber-900"}`}
      >
        {conectado ? (
          <p>
            <span className="font-medium">Conectado.</span> Los avisos salen solos desde el número del negocio. Si un mensaje falla, revisa que la plantilla esté
            aprobada en Meta con el mismo nombre.
          </p>
        ) : (
          <p>
            <span className="font-medium">Sin conectar.</span> Mientras tanto, los botones de WhatsApp abren el chat con el mensaje escrito para mandarlo a mano, y
            los avisos automáticos quedan registrados como simulados. Para conectarlo se necesita una línea exclusiva y una cuenta de WhatsApp Business en Meta;
            luego se ponen <code className="font-mono text-xs">WHATSAPP_TOKEN</code> y <code className="font-mono text-xs">WHATSAPP_PHONE_ID</code> en la
            configuración del servidor.
          </p>
        )}
      </div>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Avisos automáticos</CardTitle>
            <CardDescription>Se mandan una sola vez por venta, orden o factura, solo a clientes con celular.</CardDescription>
          </CardHeader>
          <CardContent>
            <AvisosAutomaticos plantillas={PLANTILLAS.filter((p) => p.automatica)} activos={sesion.negocio.avisosWhatsapp} puedeEditar={puedeEditar} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plantillas</CardTitle>
            <CardDescription>Dalas de alta en Meta con este nombre, categoría “Utilidad” e idioma español (MEX).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {PLANTILLAS.map((p) => (
                <li key={p.clave} className="grid gap-1 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.nombre}</span>
                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{p.clave}</code>
                  </span>
                  <span className="text-muted-foreground">{p.cuerpo}</span>
                  <span className="text-muted-foreground text-xs">{p.variables.map((v, i) => `{{${i + 1}}} ${v}`).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Mensajes recientes</h2>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Mensaje</TableHead>
              <TableHead>Estado</TableHead>
              {puedeEditar && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {mensajes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-12 text-center">
                  Todavía no se ha mandado ningún mensaje.
                </TableCell>
              </TableRow>
            )}
            {mensajes.map(({ m, cliente }) => (
              <TableRow key={m.id}>
                <TableCell className="text-muted-foreground align-top text-xs whitespace-nowrap">{formatoFechaHora(m.creadoEn)}</TableCell>
                <TableCell className="align-top">
                  <span className="font-medium">{cliente ?? m.telefono}</span>
                  <span className="text-muted-foreground block text-xs">
                    {plantilla(m.plantilla as ClavePlantilla)?.nombre ?? m.plantilla}
                    {m.automatico ? " · automático" : ""}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground hidden max-w-md align-top text-xs whitespace-normal md:table-cell">
                  {m.entidad && m.entidadId && ENLACE[m.entidad] ? (
                    <Link href={`${ENLACE[m.entidad]}/${m.entidadId}`} className="hover:underline">
                      {m.texto}
                    </Link>
                  ) : (
                    m.texto
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant={ESTADO[m.estado].variante}>{ESTADO[m.estado].texto}</Badge>
                  {m.error && <span className="text-destructive mt-1 block max-w-48 text-xs whitespace-normal">{m.error}</span>}
                </TableCell>
                {puedeEditar && <TableCell className="align-top">{m.estado !== "enviado" && conectado && <BotonReintentar id={m.id} />}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
