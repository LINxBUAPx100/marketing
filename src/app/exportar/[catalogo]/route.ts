import { obtenerSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { libroExcel } from "@/lib/excel";
import { CATALOGOS, parametrosDe } from "@/lib/reportes/exportar";

export async function GET(request: Request, { params }: RouteContext<"/exportar/[catalogo]">) {
  const sesion = await obtenerSesion();
  if (!sesion) return new Response("No autorizado", { status: 401 });
  const { catalogo: clave } = await params;
  const catalogo = Object.hasOwn(CATALOGOS, clave) ? CATALOGOS[clave] : null;
  if (!catalogo) return new Response("No encontrado", { status: 404 });
  if (!sesion.puede(catalogo.permiso)) return new Response("No tienes permiso para exportar esto.", { status: 403 });

  const p = parametrosDe(sesion, new URL(request.url).searchParams);
  const libro = libroExcel(await catalogo.hojas(sesion, p));
  await registrar(sesion, "exportar", "excel", null, { catalogo: clave, ...(catalogo.conPeriodo ? { desde: p.desde, hasta: p.hasta } : {}) });

  const nombre = `${catalogo.titulo}${catalogo.conPeriodo ? ` ${p.desde} a ${p.hasta}` : ""}.xlsx`;
  return new Response(new Uint8Array(libro), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre.normalize("NFD").replace(/[^\x20-\x7e]/g, "")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "no-store",
    },
  });
}
