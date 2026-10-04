// Datos de ejemplo para desarrollo. Se reemplazan con los datos reales de la imprenta.
// Accesos de prueba (solo para desarrollo local):
//   admin@demo.test    / demo1234   (Administrador)
//   ventas@demo.test   / demo1234   (Vendedor, solo Matriz)
//   taller@demo.test   / demo1234   (Producción, ambas sucursales)
import { eq, inArray } from "drizzle-orm";
import { crearConexion } from "../src/db/conexion";
import { crearNegocioInicial, hashPassword } from "../src/db/inicial";
import { ETAPAS_INICIALES } from "../src/lib/produccion/reglas";
import {
  categoria,
  cliente,
  etapaProduccion,
  existencia,
  existenciaInsumo,
  insumo,
  movimientoInsumo,
  movimientoInventario,
  negocio,
  producto,
  proveedor,
  receta,
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
await prepararProduccion();
await prepararAlmacen();

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

// Fase 2: qué productos van al taller y quién toma cada etapa (solo donde aún no hay responsable).
async function prepararProduccion() {
  const [n] = await db.select().from(negocio).limit(1);
  const [taller] = await db.select().from(usuario).where(eq(usuario.correo, "taller@demo.test"));
  const [ventas] = await db.select().from(usuario).where(eq(usuario.correo, "ventas@demo.test"));
  let etapas = await db.select().from(etapaProduccion).where(eq(etapaProduccion.negocioId, n.id));
  if (!etapas.length) {
    etapas = await db
      .insert(etapaProduccion)
      .values(ETAPAS_INICIALES.map((e, i) => ({ ...e, negocioId: n.id, orden: i + 1 })))
      .returning();
  }
  const responsables: Record<string, string | undefined> = { Diseño: ventas?.id, Impresión: taller?.id, Acabado: taller?.id };
  for (const e of etapas) {
    const responsableId = responsables[e.nombre];
    if (responsableId && !e.responsableId) await db.update(etapaProduccion).set({ responsableId }).where(eq(etapaProduccion.id, e.id));
  }
  await db
    .update(producto)
    .set({ requiereProduccion: true })
    .where(inArray(producto.codigo, ["VOL-MC", "VOL-CT", "TAR-44", "TAR-LM", "LON-13", "VIN-AD", "DIS-LOGO", "DIS-AJ"]));
}

// Fase 3: insumos con existencias, recetas de los productos y proveedores (costos de ejemplo).
async function prepararAlmacen() {
  const [n] = await db.select().from(negocio).limit(1);
  const hay = await db.select({ id: insumo.id }).from(insumo).where(eq(insumo.negocioId, n.id)).limit(1);
  if (hay.length) return;
  const sucursales = await db.select().from(sucursal).where(eq(sucursal.negocioId, n.id)).orderBy(sucursal.creadoEn);
  const [admin] = await db.select().from(usuario).where(eq(usuario.correo, "admin@demo.test"));

  const [papelera, tintas] = await db
    .insert(proveedor)
    .values([
      { negocioId: n.id, nombre: "Papelera del Centro", contacto: "Rosa Méndez", telefono: "222 410 2030", diasCredito: 15, notas: "Surte couché, bond y cartulina. Entrega martes y viernes." },
      { negocioId: n.id, nombre: "Distribuidora de Tintas MX", telefono: "222 555 7788", diasCredito: 0 },
    ])
    .returning();

  // costo: centavos por unidad (72.5 = $0.725 por hoja). existencias: [Matriz, Centro].
  const datos = [
    { codigo: "COU-150", nombre: "Papel couché 150 g carta", unidad: "hoja", costo: 72.5, minimo: 500, existencias: [1800, 400], proveedorId: papelera.id },
    { codigo: "BOND-75", nombre: "Papel bond 75 g carta", unidad: "hoja", costo: 18, minimo: 1000, existencias: [5000, 2000], proveedorId: papelera.id },
    { codigo: "CART-12", nombre: "Cartulina sulfatada 12 pt tabloide", unidad: "hoja", costo: 450, minimo: 100, existencias: [260, 40], proveedorId: papelera.id },
    { codigo: "TINTA", nombre: "Tinta / tóner color", unidad: "ml", costo: 150, minimo: 500, existencias: [2400, 900], proveedorId: tintas.id },
    { codigo: "LONA-13", nombre: "Lona front 13 oz (rollo 1.60 m)", unidad: "m²", costo: 3200, minimo: 20, existencias: [85, 0], proveedorId: papelera.id },
    { codigo: "VINIL", nombre: "Vinil adhesivo blanco", unidad: "m²", costo: 4800, minimo: 15, existencias: [9, 0], proveedorId: papelera.id },
  ];
  const insumos = await db
    .insert(insumo)
    .values(datos.map((d) => ({ codigo: d.codigo, nombre: d.nombre, unidad: d.unidad, costo: d.costo, proveedorId: d.proveedorId, existenciaMinima: d.minimo, negocioId: n.id })))
    .returning();
  const porCodigo = (c: string) => insumos.find((i) => i.codigo === c)!.id;
  for (const d of datos) {
    for (const [i, s] of sucursales.entries()) {
      const cantidad = d.existencias[i] ?? 0;
      if (!cantidad) continue;
      await db.insert(existenciaInsumo).values({ insumoId: porCodigo(d.codigo), sucursalId: s.id, cantidad });
      await db.insert(movimientoInsumo).values({ negocioId: n.id, sucursalId: s.id, insumoId: porCodigo(d.codigo), cantidad, motivo: "inicial", usuarioId: admin.id });
    }
  }

  const productos = await db.select().from(producto).where(eq(producto.negocioId, n.id));
  const prod = (codigo: string) => productos.find((p) => p.codigo === codigo)?.id;
  // Por UNA unidad de venta de cada producto.
  const recetas: [string, string, number][] = [
    ["VOL-MC", "COU-150", 250], ["VOL-MC", "TINTA", 25],
    ["VOL-CT", "COU-150", 100], ["VOL-CT", "TINTA", 12],
    ["TAR-44", "CART-12", 24], ["TAR-44", "TINTA", 10],
    ["TAR-LM", "CART-12", 24], ["TAR-LM", "TINTA", 10],
    ["LON-13", "LONA-13", 1.05], ["LON-13", "TINTA", 8],
    ["VIN-AD", "VINIL", 1.05], ["VIN-AD", "TINTA", 8],
    ["COP-BN", "BOND-75", 1],
    ["IMP-CO", "BOND-75", 1], ["IMP-CO", "TINTA", 0.6],
  ];
  const filas = recetas
    .map(([p, i, cantidad]) => ({ productoId: prod(p), insumoId: porCodigo(i), cantidad }))
    .filter((r): r is { productoId: string; insumoId: string; cantidad: number } => !!r.productoId);
  await db.insert(receta).values(filas);
}
