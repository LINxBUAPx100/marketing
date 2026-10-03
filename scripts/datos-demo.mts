// Datos de ejemplo para desarrollo. Se reemplazan con los datos reales de la imprenta.
// Accesos de prueba (solo para desarrollo local):
//   admin@demo.test    / demo1234   (Administrador)
//   ventas@demo.test   / demo1234   (Vendedor, solo Matriz)
//   taller@demo.test   / demo1234   (Producción, ambas sucursales)
import { eq } from "drizzle-orm";
import { crearConexion } from "../src/db/conexion";
import { crearNegocioInicial, hashPassword } from "../src/db/inicial";
import {
  categoria,
  cliente,
  existencia,
  movimientoInventario,
  negocio,
  producto,
  sucursal,
  usuario,
  usuarioSucursal,
} from "../src/db/schema";

const PASSWORD = "demo1234";
const { db, cerrar } = crearConexion();

const existente = await db.select({ id: usuario.id }).from(usuario).limit(1);
if (!existente.length) await cargarBase();
const hayProductos = await db.select({ id: producto.id }).from(producto).limit(1);
if (!hayProductos.length) await cargarCatalogo();

await cerrar();
console.log("Datos de ejemplo listos. Entra con admin@demo.test / demo1234");

async function cargarBase() {
  const { negocio: n, sucursal: matriz, roles } = await crearNegocioInicial(db, {
    negocio: "Imprenta Demo",
    sucursal: "Matriz",
    admin: { nombre: "Administración", correo: "admin@demo.test", password: PASSWORD },
  });

  const [centro] = await db
    .insert(sucursal)
    .values({ negocioId: n.id, nombre: "Sucursal Centro", prefijoFolio: "CEN", direccion: "Av. Reforma 120, Centro" })
    .returning();
  await db
    .update(sucursal)
    .set({ direccion: "Calle 5 de Mayo 45, Col. Centro", telefono: "222 000 0000" })
    .where(eq(sucursal.id, matriz.id));

  const rolDe = (nombre: string) => roles.find((r) => r.nombre === nombre)!.id;
  const hash = await hashPassword(PASSWORD);
  const [ventas, taller] = await db
    .insert(usuario)
    .values([
      { negocioId: n.id, rolId: rolDe("Vendedor"), nombre: "Laura Mostrador", correo: "ventas@demo.test", passwordHash: hash, comisionBp: 300 },
      { negocioId: n.id, rolId: rolDe("Producción"), nombre: "Pedro Taller", correo: "taller@demo.test", passwordHash: hash },
    ])
    .returning();
  await db.insert(usuarioSucursal).values([
    { usuarioId: ventas.id, sucursalId: matriz.id },
    { usuarioId: taller.id, sucursalId: matriz.id },
    { usuarioId: taller.id, sucursalId: centro.id },
  ]);
}

// Catálogo típico de imprenta, con precios de ejemplo (no son los de la imprenta real).
async function cargarCatalogo() {
  const [n] = await db.select().from(negocio).limit(1);
  const sucursales = await db.select().from(sucursal).where(eq(sucursal.negocioId, n.id)).orderBy(sucursal.creadoEn);
  const [admin] = await db.select().from(usuario).where(eq(usuario.correo, "admin@demo.test"));

  const nombres = ["Volantes", "Tarjetas de presentación", "Lonas y viniles", "Copias e impresiones", "Papelería", "Diseño"];
  const cats = await db.insert(categoria).values(nombres.map((nombre) => ({ negocioId: n.id, nombre }))).returning();
  const cat = (nombre: string) => cats.find((c) => c.nombre === nombre)!.id;
  const $ = (pesos: number) => Math.round(pesos * 100);

  const productos = await db
    .insert(producto)
    .values([
      { nombre: "Volantes media carta couché 150 g (millar)", codigo: "VOL-MC", categoriaId: cat("Volantes"), tipo: "servicio" as const, unidad: "millar", precio: $(850), precioRevendedor: $(690), costo: $(420) },
      { nombre: "Volantes carta a color (ciento)", codigo: "VOL-CT", categoriaId: cat("Volantes"), tipo: "servicio" as const, unidad: "ciento", precio: $(320), precioRevendedor: $(260), costo: $(140) },
      { nombre: "Tarjetas de presentación 4x4 (millar)", codigo: "TAR-44", categoriaId: cat("Tarjetas de presentación"), tipo: "servicio" as const, unidad: "millar", precio: $(650), precioRevendedor: $(520), costo: $(280) },
      { nombre: "Tarjetas con laminado mate (millar)", codigo: "TAR-LM", categoriaId: cat("Tarjetas de presentación"), tipo: "servicio" as const, unidad: "millar", precio: $(980), precioRevendedor: $(800), costo: $(450) },
      { nombre: "Lona front 13 oz", codigo: "LON-13", categoriaId: cat("Lonas y viniles"), tipo: "servicio" as const, unidad: "m²", precio: $(120), precioRevendedor: $(95), costo: $(48) },
      { nombre: "Vinil adhesivo impreso", codigo: "VIN-AD", categoriaId: cat("Lonas y viniles"), tipo: "servicio" as const, unidad: "m²", precio: $(220), precioRevendedor: $(180), costo: $(90) },
      { nombre: "Copia blanco y negro carta", codigo: "COP-BN", categoriaId: cat("Copias e impresiones"), tipo: "servicio" as const, unidad: "pieza", precio: $(1.5), costo: $(0.35) },
      { nombre: "Impresión a color carta", codigo: "IMP-CO", categoriaId: cat("Copias e impresiones"), tipo: "servicio" as const, unidad: "pieza", precio: $(8), costo: $(2.2) },
      { nombre: "Engargolado", codigo: "ENG", categoriaId: cat("Copias e impresiones"), tipo: "servicio" as const, unidad: "pieza", precio: $(35), costo: $(9) },
      { nombre: "Papel bond carta (paquete 500 hojas)", codigo: "PAP-BOND", categoriaId: cat("Papelería"), tipo: "producto" as const, unidad: "paquete", precio: $(135), precioRevendedor: $(118), costo: $(92), existenciaMinima: 5 },
      { nombre: "Folder tamaño carta", codigo: "FOL-CT", categoriaId: cat("Papelería"), tipo: "producto" as const, unidad: "pieza", precio: $(4), costo: $(1.6), existenciaMinima: 50 },
      { nombre: "Sobre manila tamaño carta", codigo: "SOB-MN", categoriaId: cat("Papelería"), tipo: "producto" as const, unidad: "pieza", precio: $(5), costo: $(2), existenciaMinima: 30 },
      { nombre: "Diseño de logotipo", codigo: "DIS-LOGO", categoriaId: cat("Diseño"), tipo: "servicio" as const, unidad: "servicio", precio: $(1500), costo: null },
      { nombre: "Ajuste de diseño", codigo: "DIS-AJ", categoriaId: cat("Diseño"), tipo: "servicio" as const, unidad: "servicio", precio: $(250), costo: null },
    ].map((p) => ({ ...p, negocioId: n.id })))
    .returning();

  const stock: Record<string, number[]> = { "PAP-BOND": [24, 10], "FOL-CT": [300, 120], "SOB-MN": [20, 80] };
  for (const p of productos) {
    const cantidades = stock[p.codigo ?? ""];
    if (!cantidades) continue;
    for (const [i, s] of sucursales.entries()) {
      const cantidadInicial = cantidades[i] ?? 0;
      await db.insert(existencia).values({ productoId: p.id, sucursalId: s.id, cantidad: cantidadInicial });
      await db.insert(movimientoInventario).values({ negocioId: n.id, sucursalId: s.id, productoId: p.id, cantidad: cantidadInicial, motivo: "inicial", usuarioId: admin.id });
    }
  }

  await db.insert(cliente).values(
    [
      { nombre: "María López", telefono: "222 123 4567", correo: "maria@ejemplo.test" },
      { nombre: "Taquería El Güero", empresa: "Taquería El Güero", telefono: "222 765 4321" },
      { nombre: "Jorge Ramírez", empresa: "Publicidad Ramírez", telefono: "222 555 0101", tipoPrecio: "revendedor" as const, notas: "Revende tarjetas y volantes. Paga cada viernes." },
      { nombre: "Colegio Benito Juárez", empresa: "Colegio Benito Juárez A.C.", telefono: "222 300 2000", rfc: "CBJ850101AB1", razonSocial: "COLEGIO BENITO JUAREZ", regimenFiscal: "603", codigoPostal: "72000", usoCfdi: "G03" },
    ].map((c) => ({ ...c, negocioId: n.id })),
  );
}
