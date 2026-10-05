import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/login", "/configuracion-inicial"];

// Revisión optimista: sin cookie de sesión no se entra. La validación real ocurre en el servidor.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLICAS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!request.cookies.has("sesion")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Fuera de la revisión: archivos estáticos y lo que la app instalable pide sin sesión (íconos, manifiesto, service worker).
  matcher: ["/((?!_next/|favicon.ico|icon/|apple-icon|manifest.webmanifest|sw.js|sin-conexion.html|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|webmanifest)$).*)"],
};
