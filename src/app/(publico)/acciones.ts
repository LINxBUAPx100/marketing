"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, t } from "@/db";
import { crearNegocioInicial } from "@/db/inicial";
import { crearSesion } from "@/lib/auth";
import { datosDe, erroresDe, type EstadoFormulario } from "@/lib/formulario";

// Hash de relleno para comparar cuando el correo no existe (mismo tiempo de respuesta).
const HASH_FALSO = bcrypt.hashSync("sin-usuario", 10);

const LoginSchema = z.object({
  correo: z.email({ error: "Escribe un correo válido." }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Escribe tu contraseña." }),
});

export async function iniciarSesion(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const datos = LoginSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);

  const [u] = await db.select().from(t.usuario).where(eq(t.usuario.correo, datos.data.correo));
  // Se compara aunque no exista el usuario para no revelar qué correos están registrados.
  const valido = await bcrypt.compare(datos.data.password, u?.passwordHash ?? HASH_FALSO);
  if (!u || !valido) return { mensaje: "Correo o contraseña incorrectos." };
  if (!u.activo) return { mensaje: "Este usuario está desactivado. Pide acceso a la administración." };

  await crearSesion(u.id);
  redirect("/");
}

const InicialSchema = z
  .object({
    negocio: z.string().trim().min(2, { error: "Escribe el nombre del negocio." }),
    sucursal: z.string().trim().min(2, { error: "Escribe el nombre de la sucursal." }),
    nombre: z.string().trim().min(2, { error: "Escribe tu nombre." }),
    correo: z.email({ error: "Escribe un correo válido." }).trim().toLowerCase(),
    password: z.string().min(8, { error: "Usa al menos 8 caracteres." }),
    confirmar: z.string(),
  })
  .refine((d) => d.password === d.confirmar, { error: "Las contraseñas no coinciden.", path: ["confirmar"] });

export async function configurarNegocio(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const datos = InicialSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);

  // Solo se permite una vez: si ya hay usuarios, esta pantalla no hace nada.
  const [existe] = await db.select({ id: t.usuario.id }).from(t.usuario).limit(1);
  if (existe) redirect("/login");

  const { admin } = await crearNegocioInicial(db, {
    negocio: datos.data.negocio,
    sucursal: datos.data.sucursal,
    admin: { nombre: datos.data.nombre, correo: datos.data.correo, password: datos.data.password },
  });
  await crearSesion(admin.id);
  redirect("/");
}
