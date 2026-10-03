import { leerArchivo } from "@/lib/archivos";
import { obtenerSesion } from "@/lib/auth";

const TIPO: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_: Request, { params }: RouteContext<"/archivos/[nombre]">) {
  if (!(await obtenerSesion())) return new Response("No autorizado", { status: 401 });
  const { nombre } = await params;
  const datos = await leerArchivo(nombre);
  if (!datos) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": TIPO[nombre.split(".").pop()!],
      // El nombre es único por imagen: se puede guardar en caché sin miedo.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
