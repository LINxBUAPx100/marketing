import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, t } from "@/db";

const COOKIE_SESION = "sesion";
const COOKIE_SUCURSAL = "sucursal";
const DURACION_MS = 1000 * 60 * 60 * 24 * 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function crearSesion(usuarioId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiraEn = new Date(Date.now() + DURACION_MS);
  await db.insert(t.sesion).values({ id: hashToken(token), usuarioId, expiraEn });
  await db.update(t.usuario).set({ ultimoAcceso: new Date() }).where(eq(t.usuario.id, usuarioId));
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEn,
  });
}

export async function cerrarSesion() {
  const store = await cookies();
  const token = store.get(COOKIE_SESION)?.value;
  if (token) await db.delete(t.sesion).where(eq(t.sesion.id, hashToken(token)));
  store.delete(COOKIE_SESION);
}

export type Sesion = NonNullable<Awaited<ReturnType<typeof obtenerSesion>>>;

/** Usuario de la petición actual, o null. Se calcula una sola vez por petición. */
export const obtenerSesion = cache(async () => {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token) return null;

  const [fila] = await db
    .select({ usuario: t.usuario, rol: t.rol, negocio: t.negocio })
    .from(t.sesion)
    .innerJoin(t.usuario, eq(t.usuario.id, t.sesion.usuarioId))
    .innerJoin(t.rol, eq(t.rol.id, t.usuario.rolId))
    .innerJoin(t.negocio, eq(t.negocio.id, t.usuario.negocioId))
    .where(
      and(eq(t.sesion.id, hashToken(token)), gt(t.sesion.expiraEn, new Date()), eq(t.usuario.activo, true)),
    );
  if (!fila) return null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...usuario } = fila.usuario;
  const permisos = new Set(fila.rol.permisos);
  const sucursales = await sucursalesDe(usuario.id, usuario.negocioId, fila.rol.esAdmin);

  const elegida = (await cookies()).get(COOKIE_SUCURSAL)?.value;
  const sucursal = sucursales.find((s) => s.id === elegida) ?? sucursales[0] ?? null;

  return {
    usuario,
    rol: fila.rol,
    negocio: fila.negocio,
    sucursales,
    sucursal,
    puede: (permiso: string) => fila.rol.esAdmin || permisos.has(permiso),
  };
});

async function sucursalesDe(usuarioId: string, negocioId: string, esAdmin: boolean) {
  const activas = and(eq(t.sucursal.negocioId, negocioId), eq(t.sucursal.activa, true));
  if (esAdmin) {
    return db.select().from(t.sucursal).where(activas).orderBy(asc(t.sucursal.creadoEn));
  }
  const ids = db
    .select({ id: t.usuarioSucursal.sucursalId })
    .from(t.usuarioSucursal)
    .where(eq(t.usuarioSucursal.usuarioId, usuarioId));
  return db
    .select()
    .from(t.sucursal)
    .where(and(activas, inArray(t.sucursal.id, ids)))
    .orderBy(asc(t.sucursal.creadoEn));
}

export async function requerirSesion() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  return sesion;
}

/** Para páginas: si falta el permiso, manda a la pantalla de "sin permiso". */
export async function requerirPermiso(permiso: string) {
  const sesion = await requerirSesion();
  if (!sesion.puede(permiso)) redirect("/sin-permiso");
  return sesion;
}

export async function elegirSucursal(sucursalId: string) {
  const sesion = await requerirSesion();
  if (!sesion.sucursales.some((s) => s.id === sucursalId)) return;
  (await cookies()).set(COOKIE_SUCURSAL, sucursalId, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}
