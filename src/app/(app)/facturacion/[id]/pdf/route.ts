import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { obtenerSesion } from "@/lib/auth";
import { obtenerPac } from "@/lib/facturacion/pac";

/** PDF oficial del PAC. Las facturas simuladas usan la representación impresa propia. */
export async function GET(request: Request, { params }: RouteContext<"/facturacion/[id]/pdf">) {
  const sesion = await obtenerSesion();
  if (!sesion || !sesion.puede("facturacion.ver")) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });
  const [f] = await db
    .select()
    .from(t.factura)
    .where(and(eq(t.factura.id, id), eq(t.factura.negocioId, sesion.negocio.id)));
  if (!f || !sesion.sucursales.some((s) => s.id === f.sucursalId)) return new Response("No encontrado", { status: 404 });

  const pdf = !f.simulada && f.pacId ? await obtenerPac().pdf(f.pacId).catch(() => null) : null;
  if (!pdf) return Response.redirect(new URL(`/imprimir/factura/${id}`, request.url));
  return new Response(pdf, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${f.serie}-${f.folio}.pdf"` },
  });
}
