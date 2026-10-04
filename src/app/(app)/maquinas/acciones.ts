"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, t } from "@/db";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { datosDe, dineroOpcional, erroresDe, vacioANull, type EstadoFormulario } from "@/lib/formulario";
import { agregarContador, capturarLecturas, crearMaquina, instalarConsumible, registrarMerma, retirarConsumible } from "@/lib/maquinas/servidor";

const textoOpcional = z.preprocess(vacioANull, z.string().trim().max(200).nullable().optional().transform((v) => v ?? null));
const sinPermiso = { mensaje: "No tienes permiso para hacer este cambio." };
const tipo = z.enum(t.TIPOS_IMPRESION, { error: "Elige el tipo de impresión." });

const ContadoresSchema = z
  .array(
    z.object({
      nombre: z.string().trim().min(1, { error: "Cada contador necesita nombre." }).max(40),
      tipo,
      lecturaInicial: z.number({ error: "Escribe la lectura actual de cada contador." }).min(0),
    }),
  )
  .min(1, { error: "Agrega al menos un contador." })
  .max(6);

const MaquinaSchema = z.object({
  id: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  sucursalId: z.uuid({ error: "Elige la sucursal." }),
  nombre: z.string().trim().min(2, { error: "Escribe el nombre del equipo." }).max(80),
  marca: textoOpcional,
  modelo: textoOpcional,
  serie: textoOpcional,
  notas: textoOpcional,
  activa: z.preprocess((v) => v === undefined || v === "on" || v === "true", z.boolean()),
  contadores: z.preprocess((v) => {
    if (typeof v !== "string" || !v) return [];
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }, z.unknown()),
});

export async function guardarMaquina(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("maquinas.editar")) return sinPermiso;
  const datos = MaquinaSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { id, activa, contadores, ...valores } = datos.data;

  if (id) {
    if (!sesion.sucursales.some((s) => s.id === valores.sucursalId)) return { errores: { sucursalId: ["Elige una de tus sucursales."] } };
    const [m] = await db
      .update(t.maquina)
      .set({ ...valores, activa })
      .where(and(eq(t.maquina.id, id), eq(t.maquina.negocioId, sesion.negocio.id)))
      .returning({ id: t.maquina.id });
    if (!m) return { mensaje: "La máquina ya no existe." };
    await registrar(sesion, "editar", "maquina", id, { nombre: valores.nombre });
  } else {
    const c = ContadoresSchema.safeParse(contadores);
    if (!c.success) return { errores: { contadores: [c.error.issues[0]?.message ?? "Revisa los contadores."] } };
    const r = await crearMaquina(sesion, { ...valores, contadores: c.data });
    if (!r.ok) return { mensaje: r.mensaje };
  }
  revalidatePath("/maquinas", "layout");
  return { ok: true, mensaje: id ? "Equipo actualizado." : "Equipo registrado." };
}

export async function nuevoContador(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("maquinas.editar")) return sinPermiso;
  const datos = z
    .object({
      maquinaId: z.uuid(),
      nombre: z.string().trim().min(1, { error: "Escribe el nombre." }).max(40),
      tipo,
      lecturaInicial: z.coerce.number({ error: "Escribe la lectura actual." }).min(0),
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { maquinaId, ...c } = datos.data;
  const r = await agregarContador(sesion, maquinaId, c);
  if (!r.ok) return { mensaje: r.mensaje };
  revalidatePath(`/maquinas/${maquinaId}`);
  return { ok: true, mensaje: "Contador agregado." };
}

const LecturasSchema = z.object({
  momento: z.enum(["apertura", "cierre", "otra"]),
  nota: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .transform((v) => v || null),
  lecturas: z.array(z.object({ contadorId: z.uuid(), valor: z.number().min(0) })).max(50),
});

export async function guardarLecturas(entrada: z.input<typeof LecturasSchema>) {
  const sesion = await requerirSesion();
  if (!sesion.puede("maquinas.lecturas")) return { ok: false as const, mensaje: "No tienes permiso para capturar lecturas." };
  const datos = LecturasSchema.safeParse(entrada);
  if (!datos.success) return { ok: false as const, mensaje: "Revisa las lecturas: deben ser números." };
  const r = await capturarLecturas(sesion, datos.data);
  if (r.ok) revalidatePath("/maquinas", "layout");
  return r;
}

export async function guardarMerma(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("maquinas.mermas")) return { mensaje: "No tienes permiso para registrar mermas." };
  const datos = z
    .object({
      maquinaId: z.uuid({ error: "Elige el equipo." }),
      tipo,
      cantidad: z.coerce.number({ error: "Escribe cuántas impresiones." }).positive({ error: "Debe ser mayor que cero." }).max(100_000),
      motivo: z.enum(t.MOTIVOS_MERMA, { error: "Elige el motivo." }),
      responsableId: z.preprocess(vacioANull, z.uuid().nullable().optional().transform((v) => v ?? null)),
      nota: textoOpcional,
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const r = await registrarMerma(sesion, datos.data);
  if (!r.ok) return { mensaje: r.mensaje };
  revalidatePath("/maquinas", "layout");
  return { ok: true, mensaje: "Merma registrada." };
}

export async function guardarConsumible(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("consumibles.editar")) return { mensaje: "No tienes permiso para instalar consumibles." };
  const datos = z
    .object({
      maquinaId: z.uuid(),
      contadorId: z.uuid({ error: "Elige con qué contador se mide." }),
      nombre: z.string().trim().min(2, { error: "Escribe qué se instala (ej. Tóner negro)." }).max(60),
      rendimiento: z.coerce.number({ error: "Escribe cuántas impresiones rinde." }).int().positive({ error: "Debe ser mayor que cero." }),
      costo: dineroOpcional(),
      insumoId: z.preprocess(vacioANull, z.uuid().nullable().optional().transform((v) => v ?? null)),
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const r = await instalarConsumible(sesion, datos.data);
  if (!r.ok) return { mensaje: r.mensaje };
  revalidatePath("/maquinas", "layout");
  revalidatePath("/consumibles");
  return { ok: true, mensaje: "Consumible instalado." };
}

export async function retirar(consumibleId: string) {
  const sesion = await requerirSesion();
  if (!sesion.puede("consumibles.editar")) return { ok: false as const, mensaje: "No tienes permiso." };
  if (!z.uuid().safeParse(consumibleId).success) return { ok: false as const, mensaje: "Consumible inválido." };
  const r = await retirarConsumible(sesion, consumibleId);
  if (r.ok) {
    revalidatePath("/maquinas", "layout");
    revalidatePath("/consumibles");
  }
  return r;
}
