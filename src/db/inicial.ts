import bcrypt from "bcryptjs";
import { ROLES_INICIALES } from "@/lib/permisos";
import { ETAPAS_INICIALES } from "@/lib/produccion/reglas";
import type { Db } from "./conexion";
import { etapaProduccion, negocio, rol, sucursal, usuario, usuarioSucursal } from "./schema";

export type DatosIniciales = {
  negocio: string;
  sucursal: string;
  admin: { nombre: string; correo: string; password: string };
};

export const hashPassword = (password: string) => bcrypt.hash(password, 10);

/** Crea el negocio, su primera sucursal, los roles base y el usuario administrador. */
export async function crearNegocioInicial(db: Db, datos: DatosIniciales) {
  return db.transaction(async (tx) => {
    const [n] = await tx.insert(negocio).values({ nombre: datos.negocio }).returning();
    const [s] = await tx
      .insert(sucursal)
      .values({ negocioId: n.id, nombre: datos.sucursal, prefijoFolio: prefijoDe(datos.sucursal) })
      .returning();
    const roles = await tx
      .insert(rol)
      .values(ROLES_INICIALES.map((r) => ({ ...r, negocioId: n.id })))
      .returning();
    const admin = roles.find((r) => r.esAdmin)!;
    const [u] = await tx
      .insert(usuario)
      .values({
        negocioId: n.id,
        rolId: admin.id,
        nombre: datos.admin.nombre,
        correo: datos.admin.correo.toLowerCase(),
        passwordHash: await hashPassword(datos.admin.password),
      })
      .returning();
    await tx.insert(usuarioSucursal).values({ usuarioId: u.id, sucursalId: s.id });
    await tx.insert(etapaProduccion).values(ETAPAS_INICIALES.map((e, i) => ({ ...e, negocioId: n.id, orden: i + 1 })));
    return { negocio: n, sucursal: s, roles, admin: u };
  });
}

/** "Sucursal Centro" → "SC", "Matriz" → "MAT". */
export function prefijoDe(nombre: string) {
  const palabras = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  if (palabras.length > 1) return palabras.map((p) => p[0]).join("").slice(0, 4);
  return (palabras[0] ?? "SUC").slice(0, 3);
}
