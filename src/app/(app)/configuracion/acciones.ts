"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, t } from "@/db";
import { hashPassword } from "@/db/inicial";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { datosDe, erroresDe, vacioANull, type EstadoFormulario } from "@/lib/formulario";
import { aPuntosBase } from "@/lib/numeros";
import { TODOS_LOS_PERMISOS } from "@/lib/permisos";

const sinPermiso = { mensaje: "No tienes permiso para hacer este cambio." };
const textoOpcional = z.preprocess(vacioANull, z.string().trim().nullable().optional());
const casilla = z.preprocess((v) => v === "on" || v === "true", z.boolean());

async function autorizar(permiso: string) {
  const sesion = await requerirSesion();
  return sesion.puede(permiso) ? sesion : null;
}

// ─── Negocio ────────────────────────────────────────────────────────────────

const NegocioSchema = z.object({
  nombre: z.string().trim().min(2, { error: "Escribe el nombre comercial." }),
  razonSocial: textoOpcional,
  rfc: z.preprocess(
    vacioANull,
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, { error: "El RFC no tiene un formato válido." })
      .nullable()
      .optional(),
  ),
  regimenFiscal: textoOpcional,
  codigoPostal: z.preprocess(
    vacioANull,
    z.string().trim().regex(/^\d{5}$/, { error: "El código postal tiene 5 dígitos." }).nullable().optional(),
  ),
  direccion: textoOpcional,
  telefono: textoOpcional,
  correo: z.preprocess(vacioANull, z.email({ error: "Escribe un correo válido." }).nullable().optional()),
  iva: z.coerce.number({ error: "Escribe un número." }).min(0).max(100),
  preciosIncluyenIva: casilla,
});

export async function guardarNegocio(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await autorizar("negocio.editar");
  if (!sesion) return sinPermiso;
  const datos = NegocioSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);

  const { iva, ...resto } = datos.data;
  await db
    .update(t.negocio)
    .set({ ...resto, ivaBp: aPuntosBase(iva) })
    .where(eq(t.negocio.id, sesion.negocio.id));
  await registrar(sesion, "editar", "negocio", sesion.negocio.id);
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Datos del negocio guardados." };
}

// ─── Sucursales ─────────────────────────────────────────────────────────────

const SucursalSchema = z.object({
  id: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  nombre: z.string().trim().min(2, { error: "Escribe el nombre de la sucursal." }),
  prefijoFolio: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,5}$/, { error: "De 1 a 5 letras o números, sin espacios." }),
  direccion: textoOpcional,
  telefono: textoOpcional,
  activa: casilla,
});

export async function guardarSucursal(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await autorizar("sucursales.editar");
  if (!sesion) return sinPermiso;
  const datos = SucursalSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { id, ...valores } = datos.data;

  const [repetido] = await db
    .select({ id: t.sucursal.id })
    .from(t.sucursal)
    .where(
      and(
        eq(t.sucursal.negocioId, sesion.negocio.id),
        eq(t.sucursal.prefijoFolio, valores.prefijoFolio),
        id ? ne(t.sucursal.id, id) : undefined,
      ),
    );
  if (repetido) return { errores: { prefijoFolio: ["Otra sucursal ya usa este prefijo."] } };

  if (id) {
    if (!valores.activa) {
      const activas = await db
        .select({ id: t.sucursal.id })
        .from(t.sucursal)
        .where(and(eq(t.sucursal.negocioId, sesion.negocio.id), eq(t.sucursal.activa, true), ne(t.sucursal.id, id)));
      if (!activas.length) return { mensaje: "Debe quedar al menos una sucursal activa." };
    }
    await db
      .update(t.sucursal)
      .set(valores)
      .where(and(eq(t.sucursal.id, id), eq(t.sucursal.negocioId, sesion.negocio.id)));
    await registrar(sesion, "editar", "sucursal", id, { nombre: valores.nombre, activa: valores.activa });
  } else {
    const [nueva] = await db
      .insert(t.sucursal)
      .values({ ...valores, negocioId: sesion.negocio.id })
      .returning();
    await registrar(sesion, "crear", "sucursal", nueva.id, { nombre: nueva.nombre });
  }
  revalidatePath("/", "layout");
  return { ok: true, mensaje: id ? "Sucursal actualizada." : "Sucursal creada." };
}

// ─── Roles ──────────────────────────────────────────────────────────────────

const RolSchema = z.object({
  id: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  nombre: z.string().trim().min(2, { error: "Escribe el nombre del rol." }),
  descripcion: textoOpcional,
});

export async function guardarRol(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await autorizar("roles.editar");
  if (!sesion) return sinPermiso;
  const datos = RolSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { id, ...valores } = datos.data;

  // Solo se guardan claves que existen en el catálogo.
  const permisos = formData
    .getAll("permisos")
    .map(String)
    .filter((p) => TODOS_LOS_PERMISOS.includes(p));

  if (id) {
    const [actual] = await db
      .select()
      .from(t.rol)
      .where(and(eq(t.rol.id, id), eq(t.rol.negocioId, sesion.negocio.id)));
    if (!actual) return { mensaje: "El rol ya no existe." };
    if (actual.esAdmin) return { mensaje: "El rol Administrador no se puede modificar." };
    await db.update(t.rol).set({ ...valores, permisos }).where(eq(t.rol.id, id));
    await registrar(sesion, "editar", "rol", id, { nombre: valores.nombre, permisos: permisos.length });
    revalidatePath("/configuracion/roles");
    return { ok: true, mensaje: "Permisos guardados." };
  }

  const [nuevo] = await db
    .insert(t.rol)
    .values({ ...valores, permisos, negocioId: sesion.negocio.id })
    .returning();
  await registrar(sesion, "crear", "rol", nuevo.id, { nombre: nuevo.nombre });
  redirect(`/configuracion/roles/${nuevo.id}`);
}

// ─── Usuarios ───────────────────────────────────────────────────────────────

const UsuarioSchema = z.object({
  id: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  nombre: z.string().trim().min(2, { error: "Escribe el nombre." }),
  correo: z.email({ error: "Escribe un correo válido." }).trim().toLowerCase(),
  telefono: textoOpcional,
  rolId: z.uuid({ error: "Elige un rol." }),
  comision: z.coerce.number({ error: "Escribe un número." }).min(0).max(100),
  activo: casilla,
  password: z.preprocess(
    vacioANull,
    z.string().min(8, { error: "Usa al menos 8 caracteres." }).nullable().optional(),
  ),
});

export async function guardarUsuario(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await autorizar("usuarios.editar");
  if (!sesion) return sinPermiso;
  const datos = UsuarioSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { id, comision, password, ...valores } = datos.data;
  const sucursales = formData.getAll("sucursales").map(String);

  if (!id && !password) return { errores: { password: ["Escribe una contraseña para el nuevo usuario."] } };
  if (!sucursales.length) return { errores: { sucursales: ["Elige al menos una sucursal."] } };

  const [rolElegido] = await db
    .select()
    .from(t.rol)
    .where(and(eq(t.rol.id, valores.rolId), eq(t.rol.negocioId, sesion.negocio.id)));
  if (!rolElegido) return { errores: { rolId: ["Elige un rol válido."] } };

  const validas = await db
    .select({ id: t.sucursal.id })
    .from(t.sucursal)
    .where(eq(t.sucursal.negocioId, sesion.negocio.id));
  const sucursalesValidas = sucursales.filter((s) => validas.some((v) => v.id === s));

  const [correoUsado] = await db
    .select({ id: t.usuario.id })
    .from(t.usuario)
    .where(and(eq(t.usuario.correo, valores.correo), id ? ne(t.usuario.id, id) : undefined));
  if (correoUsado) return { errores: { correo: ["Ya hay un usuario con este correo."] } };

  if (id === sesion.usuario.id && (!valores.activo || !rolElegido.esAdmin) && sesion.rol.esAdmin) {
    return { mensaje: "No puedes quitarte a ti mismo el acceso de administración ni desactivarte." };
  }

  const cambios = {
    ...valores,
    comisionBp: aPuntosBase(comision),
    ...(password ? { passwordHash: await hashPassword(password) } : {}),
  };

  await db.transaction(async (tx) => {
    let usuarioId = id;
    if (id) {
      await tx
        .update(t.usuario)
        .set(cambios)
        .where(and(eq(t.usuario.id, id), eq(t.usuario.negocioId, sesion.negocio.id)));
      await tx.delete(t.usuarioSucursal).where(eq(t.usuarioSucursal.usuarioId, id));
      // Al desactivar o cambiar contraseña se cierran sus sesiones abiertas.
      if (!valores.activo || password) await tx.delete(t.sesion).where(eq(t.sesion.usuarioId, id));
    } else {
      const [nuevo] = await tx
        .insert(t.usuario)
        .values({ ...cambios, negocioId: sesion.negocio.id, passwordHash: cambios.passwordHash! })
        .returning({ id: t.usuario.id });
      usuarioId = nuevo.id;
    }
    await tx.insert(t.usuarioSucursal).values(sucursalesValidas.map((sucursalId) => ({ usuarioId: usuarioId!, sucursalId })));
  });

  await registrar(sesion, id ? "editar" : "crear", "usuario", id ?? null, {
    nombre: valores.nombre,
    rol: rolElegido.nombre,
    activo: valores.activo,
    cambioPassword: !!password,
  });
  revalidatePath("/configuracion/usuarios");
  return { ok: true, mensaje: id ? "Usuario actualizado." : "Usuario creado." };
}
