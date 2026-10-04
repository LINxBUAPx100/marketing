"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, t } from "@/db";
import { guardarImagen, validarImagen } from "@/lib/archivos";
import { requerirSesion } from "@/lib/auth";
import { registrar } from "@/lib/bitacora";
import { datosDe, dinero, dineroOpcional, erroresDe, vacioANull, type EstadoFormulario } from "@/lib/formulario";
import { moverExistencia } from "@/lib/almacen/existencias";

const sinPermiso = { mensaje: "No tienes permiso para hacer este cambio." };
const textoOpcional = z.preprocess(vacioANull, z.string().trim().nullable().optional());
const casilla = z.preprocess((v) => v === "on" || v === "true", z.boolean());
const numero = (mensaje: string) =>
  // Vacío o ausente (p. ej. un servicio no muestra existencias) cuenta como 0.
  z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? 0 : v), z.coerce.number({ error: mensaje }));

// ─── Categorías ─────────────────────────────────────────────────────────────

export async function guardarCategoria(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("productos.editar")) return sinPermiso;
  const datos = z
    .object({
      id: z.preprocess(vacioANull, z.uuid().nullable().optional()),
      nombre: z.string().trim().min(2, { error: "Escribe el nombre de la categoría." }),
      // Vacío = usa la comisión de cada vendedor.
      comision: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.coerce.number({ error: "Escribe un porcentaje." }).min(0).max(100).nullable()),
      activa: casilla,
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { id, comision, ...resto } = datos.data;
  const valores = { ...resto, comisionBp: comision == null ? null : Math.round(comision * 100) };

  if (id) {
    await db
      .update(t.categoria)
      .set(valores)
      .where(and(eq(t.categoria.id, id), eq(t.categoria.negocioId, sesion.negocio.id)));
  } else {
    await db.insert(t.categoria).values({ ...valores, negocioId: sesion.negocio.id });
  }
  await registrar(sesion, id ? "editar" : "crear", "categoria", id ?? null, { nombre: valores.nombre });
  revalidatePath("/productos");
  return { ok: true, mensaje: id ? "Categoría actualizada." : "Categoría creada." };
}

// ─── Productos ──────────────────────────────────────────────────────────────

const ProductoSchema = z.object({
  id: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  nombre: z.string().trim().min(2, { error: "Escribe el nombre del producto." }),
  codigo: textoOpcional,
  categoriaId: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  descripcion: textoOpcional,
  tipo: z.enum(["producto", "servicio"]),
  unidad: z.string().trim().min(1, { error: "Escribe la unidad de venta." }),
  precio: dinero("Escribe el precio al público."),
  precioRevendedor: dineroOpcional(),
  costo: dineroOpcional(),
  existenciaMinima: numero("Escribe un número.").pipe(z.number().min(0, { error: "No puede ser negativo." })),
  existenciaInicial: numero("Escribe un número.").optional(),
  activo: casilla,
  requiereProduccion: casilla,
  tipoImpresion: z.preprocess(vacioANull, z.enum(["byn", "color", "gran_formato"]).nullable().optional().transform((v) => v ?? null)),
  impresionesPorUnidad: numero("Escribe un número.").pipe(z.number().min(0, { error: "No puede ser negativo." })),
  quitarImagen: casilla,
});

export async function guardarProducto(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  const datos = ProductoSchema.safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { id, existenciaInicial, quitarImagen, costo, ...valores } = datos.data;
  if (!sesion.puede(id ? "productos.editar" : "productos.crear")) return sinPermiso;

  const archivo = formData.get("imagen");
  let imagen: string | null | undefined;
  if (archivo instanceof File && archivo.size > 0) {
    const error = validarImagen(archivo);
    if (error) return { errores: { imagen: [error] } };
    imagen = await guardarImagen(archivo);
  } else if (quitarImagen) {
    imagen = null;
  }

  // Solo quien ve costos puede cambiarlos.
  const cambios = {
    ...valores,
    ...(sesion.puede("productos.costos") ? { costo } : {}),
    ...(imagen !== undefined ? { imagen } : {}),
  };

  if (id) {
    const [actual] = await db
      .update(t.producto)
      .set(cambios)
      .where(and(eq(t.producto.id, id), eq(t.producto.negocioId, sesion.negocio.id)))
      .returning({ id: t.producto.id });
    if (!actual) return { mensaje: "El producto ya no existe." };
    await registrar(sesion, "editar", "producto", id, { nombre: valores.nombre, precio: valores.precio });
    revalidatePath("/productos");
    return { ok: true, mensaje: "Producto guardado." };
  }

  const [nuevo] = await db
    .insert(t.producto)
    .values({ ...cambios, negocioId: sesion.negocio.id })
    .returning({ id: t.producto.id });
  if (valores.tipo === "producto" && existenciaInicial && sesion.sucursal) {
    await db.transaction((tx) =>
      moverExistencia(tx, {
        negocioId: sesion.negocio.id,
        sucursalId: sesion.sucursal!.id,
        productoId: nuevo.id,
        cantidad: existenciaInicial,
        motivo: "inicial",
        usuarioId: sesion.usuario.id,
      }),
    );
  }
  await registrar(sesion, "crear", "producto", nuevo.id, { nombre: valores.nombre, precio: valores.precio });
  revalidatePath("/productos");
  redirect("/productos");
}

/** Ajuste por conteo físico: se escribe lo que hay y se registra la diferencia. */
export async function ajustarExistencia(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const sesion = await requerirSesion();
  if (!sesion.puede("almacen.ajustar") && !sesion.puede("productos.editar")) return sinPermiso;
  const datos = z
    .object({
      productoId: z.uuid(),
      sucursalId: z.uuid(),
      cantidad: z.coerce.number({ error: "Escribe la cantidad contada." }),
      nota: textoOpcional,
    })
    .safeParse(datosDe(formData));
  if (!datos.success) return erroresDe(datos.error);
  const { productoId, sucursalId, cantidad, nota } = datos.data;

  const [producto] = await db
    .select()
    .from(t.producto)
    .where(and(eq(t.producto.id, productoId), eq(t.producto.negocioId, sesion.negocio.id)));
  const [sucursal] = await db
    .select()
    .from(t.sucursal)
    .where(and(eq(t.sucursal.id, sucursalId), eq(t.sucursal.negocioId, sesion.negocio.id)));
  if (!producto || !sucursal) return { mensaje: "El producto o la sucursal ya no existen." };

  const [actual] = await db
    .select({ cantidad: t.existencia.cantidad })
    .from(t.existencia)
    .where(and(eq(t.existencia.productoId, productoId), eq(t.existencia.sucursalId, sucursalId)));
  const diferencia = Math.round((cantidad - (actual?.cantidad ?? 0)) * 1000) / 1000;
  if (diferencia === 0) return { ok: true, mensaje: "La existencia ya coincide; no hubo cambios." };

  await db.transaction((tx) =>
    moverExistencia(tx, {
      negocioId: sesion.negocio.id,
      sucursalId,
      productoId,
      cantidad: diferencia,
      motivo: "ajuste",
      usuarioId: sesion.usuario.id,
      nota: nota ?? undefined,
    }),
  );
  await registrar(sesion, "ajustar", "existencia", productoId, { nombre: producto.nombre, sucursal: sucursal.nombre, diferencia });
  revalidatePath(`/productos/${productoId}`);
  return { ok: true, mensaje: `Existencia ajustada (${diferencia > 0 ? "+" : ""}${diferencia}).` };
}

// ─── Precios por volumen ────────────────────────────────────────────────────

const VolumenSchema = z.object({
  productoId: z.uuid(),
  escalones: z
    .array(
      z.object({
        desde: z.number().positive({ error: "La cantidad debe ser mayor que cero." }).max(10_000_000),
        precio: z.number().int().min(0),
        precioRevendedor: z.number().int().min(0).nullable(),
      }),
    )
    .max(10),
});

/** Reemplaza todos los escalones de precio por volumen de un producto. */
export async function guardarVolumen(entrada: z.input<typeof VolumenSchema>) {
  const sesion = await requerirSesion();
  if (!sesion.puede("productos.editar")) return { ok: false as const, mensaje: "No tienes permiso para editar productos." };
  const datos = VolumenSchema.safeParse(entrada);
  if (!datos.success) return { ok: false as const, mensaje: datos.error.issues[0]?.message ?? "Revisa los escalones." };
  const { productoId, escalones } = datos.data;
  if (new Set(escalones.map((e) => e.desde)).size !== escalones.length) return { ok: false as const, mensaje: "Hay dos escalones con la misma cantidad." };

  const [producto] = await db.select().from(t.producto).where(and(eq(t.producto.id, productoId), eq(t.producto.negocioId, sesion.negocio.id)));
  if (!producto) return { ok: false as const, mensaje: "El producto ya no existe." };
  await db.transaction(async (tx) => {
    await tx.delete(t.precioVolumen).where(eq(t.precioVolumen.productoId, productoId));
    if (escalones.length) await tx.insert(t.precioVolumen).values(escalones.map((e) => ({ ...e, productoId })));
  });
  await registrar(sesion, "editar", "volumen", productoId, { nombre: producto.nombre, escalones: escalones.length });
  revalidatePath(`/productos/${productoId}`);
  return { ok: true as const };
}
