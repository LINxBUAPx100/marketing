// Datos de ejemplo para desarrollo. Se reemplazan con los datos reales de la imprenta.
// Accesos de prueba (solo para desarrollo local):
//   admin@demo.test    / demo1234   (Administrador)
//   ventas@demo.test   / demo1234   (Vendedor, solo Matriz)
//   taller@demo.test   / demo1234   (Producción, ambas sucursales)
import { eq } from "drizzle-orm";
import { crearConexion } from "../src/db/conexion";
import { crearNegocioInicial, hashPassword } from "../src/db/inicial";
import { sucursal, usuario, usuarioSucursal } from "../src/db/schema";

const PASSWORD = "demo1234";
const { db, cerrar } = crearConexion();

const existente = await db.select({ id: usuario.id }).from(usuario).limit(1);
if (existente.length) {
  console.log("La base ya tiene datos; no se cargó nada.");
  await cerrar();
  process.exit(0);
}

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

await cerrar();
console.log("Datos de ejemplo cargados. Entra con admin@demo.test / demo1234");
