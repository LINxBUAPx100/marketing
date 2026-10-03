import "server-only";
import { crearConexion, type Conexion, type Db } from "./conexion";

// Una sola conexión por proceso, también entre recargas en desarrollo.
// Se abre en la primera consulta y no al importar: el build carga los módulos
// en varios procesos a la vez y PGlite no admite más de uno sobre la misma carpeta.
const global = globalThis as unknown as { __conexion?: Conexion };
const conexion = () => (global.__conexion ??= crearConexion());

export const db = new Proxy({} as Db, {
  get(_, propiedad) {
    const real = conexion().db;
    const valor = Reflect.get(real, propiedad, real);
    return typeof valor === "function" ? valor.bind(real) : valor;
  },
});

export * as t from "./schema";
