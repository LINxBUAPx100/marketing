import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { obtenerSesion } from "@/lib/auth";

export async function GET(_: Request, { params }: RouteContext<"/facturacion/[id]/xml">) {
  const sesion = await obtenerSesion();
  if (!sesion || !sesion.puede("facturacion.ver")) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });
  const [f] = await db
    .select({ xml: t.factura.xml, serie: t.factura.serie, folio: t.factura.folio, sucursalId: t.factura.sucursalId })
    .from(t.factura)
    .where(and(eq(t.factura.id, id), eq(t.factura.negocioId, sesion.negocio.id)));
  if (!f?.xml || !sesion.sucursales.some((s) => s.id === f.sucursalId)) return new Response("No encontrado", { status: 404 });
  return new Response(f.xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${f.serie}-${f.folio}.xml"`,
    },
  });
}
