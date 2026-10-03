import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Convenciones:
// - Dinero en centavos (integer). Porcentajes en puntos base (1600 = 16.00 %).
// - Nada se borra: los registros se desactivan o se cancelan.
// - Todas las tablas cuelgan de `negocio` para poder volverlo multi-empresa después.

const creadoEn = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const negocio = pgTable("negocio", {
  id: uuid().primaryKey().defaultRandom(),
  nombre: text().notNull(),
  razonSocial: text(),
  rfc: text(),
  regimenFiscal: text(),
  codigoPostal: text(),
  direccion: text(),
  telefono: text(),
  correo: text(),
  ivaBp: integer().notNull().default(1600),
  preciosIncluyenIva: boolean().notNull().default(true),
  creadoEn: creadoEn(),
});

export const sucursal = pgTable("sucursal", {
  id: uuid().primaryKey().defaultRandom(),
  negocioId: uuid()
    .notNull()
    .references(() => negocio.id),
  nombre: text().notNull(),
  prefijoFolio: text().notNull(),
  direccion: text(),
  telefono: text(),
  activa: boolean().notNull().default(true),
  creadoEn: creadoEn(),
});

export const rol = pgTable("rol", {
  id: uuid().primaryKey().defaultRandom(),
  negocioId: uuid()
    .notNull()
    .references(() => negocio.id),
  nombre: text().notNull(),
  descripcion: text(),
  // Claves "modulo.accion", ver src/lib/permisos.ts
  permisos: text().array().notNull().default([]),
  // El rol administrador tiene todos los permisos y no se puede editar.
  esAdmin: boolean().notNull().default(false),
  creadoEn: creadoEn(),
});

export const usuario = pgTable("usuario", {
  id: uuid().primaryKey().defaultRandom(),
  negocioId: uuid()
    .notNull()
    .references(() => negocio.id),
  rolId: uuid()
    .notNull()
    .references(() => rol.id),
  nombre: text().notNull(),
  correo: text().notNull().unique(),
  telefono: text(),
  passwordHash: text().notNull(),
  comisionBp: integer().notNull().default(0),
  activo: boolean().notNull().default(true),
  ultimoAcceso: timestamp({ withTimezone: true }),
  creadoEn: creadoEn(),
});

// Sucursales a las que tiene acceso cada usuario (el administrador ve todas).
export const usuarioSucursal = pgTable(
  "usuario_sucursal",
  {
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    sucursalId: uuid()
      .notNull()
      .references(() => sucursal.id),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.sucursalId] })],
);

export const sesion = pgTable("sesion", {
  // SHA-256 del token que vive en la cookie; el token en claro nunca se guarda.
  id: text().primaryKey(),
  usuarioId: uuid()
    .notNull()
    .references(() => usuario.id),
  expiraEn: timestamp({ withTimezone: true }).notNull(),
  creadoEn: creadoEn(),
});

export const bitacora = pgTable(
  "bitacora",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    usuarioId: uuid().references(() => usuario.id),
    sucursalId: uuid().references(() => sucursal.id),
    accion: text().notNull(),
    entidad: text().notNull(),
    entidadId: text(),
    detalle: jsonb(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.negocioId, t.creadoEn)],
);
