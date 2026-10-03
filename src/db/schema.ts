import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
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

// ─── Fase 1: catálogo ───────────────────────────────────────────────────────

const cantidad = () => numeric({ precision: 12, scale: 3, mode: "number" });

export const categoria = pgTable("categoria", {
  id: uuid().primaryKey().defaultRandom(),
  negocioId: uuid()
    .notNull()
    .references(() => negocio.id),
  nombre: text().notNull(),
  activa: boolean().notNull().default(true),
  creadoEn: creadoEn(),
});

export const producto = pgTable(
  "producto",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    categoriaId: uuid().references(() => categoria.id),
    codigo: text(),
    nombre: text().notNull(),
    descripcion: text(),
    // "producto" lleva existencias; "servicio" (diseño, impresión por pieza) no.
    tipo: text({ enum: ["producto", "servicio"] }).notNull().default("producto"),
    unidad: text().notNull().default("pieza"),
    precio: integer().notNull(),
    precioRevendedor: integer(),
    costo: integer(),
    existenciaMinima: cantidad().notNull().default(0),
    imagen: text(),
    activo: boolean().notNull().default(true),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.negocioId, t.nombre)],
);

export const existencia = pgTable(
  "existencia",
  {
    productoId: uuid()
      .notNull()
      .references(() => producto.id),
    sucursalId: uuid()
      .notNull()
      .references(() => sucursal.id),
    cantidad: cantidad().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productoId, t.sucursalId] })],
);

// Cada entrada o salida de inventario queda registrada (cantidad con signo).
export const movimientoInventario = pgTable("movimiento_inventario", {
  id: uuid().primaryKey().defaultRandom(),
  negocioId: uuid()
    .notNull()
    .references(() => negocio.id),
  sucursalId: uuid()
    .notNull()
    .references(() => sucursal.id),
  productoId: uuid()
    .notNull()
    .references(() => producto.id),
  cantidad: cantidad().notNull(),
  motivo: text({ enum: ["inicial", "ajuste", "venta", "cancelacion"] }).notNull(),
  ventaId: uuid(),
  usuarioId: uuid().references(() => usuario.id),
  nota: text(),
  creadoEn: creadoEn(),
});

// ─── Fase 1: clientes ───────────────────────────────────────────────────────

export const cliente = pgTable(
  "cliente",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    nombre: text().notNull(),
    empresa: text(),
    telefono: text(),
    correo: text(),
    // Lista de precios que se le aplica en ventas.
    tipoPrecio: text({ enum: ["publico", "revendedor"] }).notNull().default("publico"),
    rfc: text(),
    razonSocial: text(),
    regimenFiscal: text(),
    codigoPostal: text(),
    usoCfdi: text(),
    notas: text(),
    activo: boolean().notNull().default(true),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.negocioId, t.nombre)],
);

// ─── Fase 1: ventas, pagos y caja ───────────────────────────────────────────

// Consecutivo por sucursal y tipo de documento (venta, cotización…).
export const folio = pgTable(
  "folio",
  {
    sucursalId: uuid()
      .notNull()
      .references(() => sucursal.id),
    tipo: text().notNull(),
    ultimo: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.sucursalId, t.tipo] })],
);

export const corteCaja = pgTable("corte_caja", {
  id: uuid().primaryKey().defaultRandom(),
  negocioId: uuid()
    .notNull()
    .references(() => negocio.id),
  sucursalId: uuid()
    .notNull()
    .references(() => sucursal.id),
  usuarioId: uuid()
    .notNull()
    .references(() => usuario.id),
  // Copia de los totales del periodo al momento del corte.
  resumen: jsonb().notNull(),
  efectivoEsperado: integer().notNull(),
  efectivoContado: integer().notNull(),
  fondoSiguiente: integer().notNull().default(0),
  notas: text(),
  creadoEn: creadoEn(),
});

export const venta = pgTable(
  "venta",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    sucursalId: uuid()
      .notNull()
      .references(() => sucursal.id),
    folio: text().notNull(),
    clienteId: uuid().references(() => cliente.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    subtotal: integer().notNull(),
    descuento: integer().notNull().default(0),
    iva: integer().notNull(),
    total: integer().notNull(),
    pagado: integer().notNull().default(0),
    estado: text({ enum: ["activa", "cancelada"] }).notNull().default("activa"),
    fechaEntrega: timestamp({ withTimezone: true }),
    notas: text(),
    motivoCancelacion: text(),
    canceladaPor: uuid().references(() => usuario.id),
    canceladaEn: timestamp({ withTimezone: true }),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.negocioId, t.creadoEn), index().on(t.clienteId), uniqueIndex().on(t.sucursalId, t.folio)],
);

export const ventaPartida = pgTable("venta_partida", {
  id: uuid().primaryKey().defaultRandom(),
  ventaId: uuid()
    .notNull()
    .references(() => venta.id),
  productoId: uuid().references(() => producto.id),
  descripcion: text().notNull(),
  unidad: text().notNull(),
  cantidad: cantidad().notNull(),
  precioUnitario: integer().notNull(),
  descuento: integer().notNull().default(0),
  importe: integer().notNull(),
  notas: text(),
  orden: integer().notNull(),
});

export const METODOS_PAGO = ["efectivo", "tarjeta", "transferencia", "cheque"] as const;

export const pago = pgTable(
  "pago",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    sucursalId: uuid()
      .notNull()
      .references(() => sucursal.id),
    ventaId: uuid()
      .notNull()
      .references(() => venta.id),
    metodo: text({ enum: METODOS_PAGO }).notNull(),
    monto: integer().notNull(),
    // Efectivo entregado por el cliente, para calcular el cambio.
    recibido: integer(),
    referencia: text(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    corteId: uuid().references(() => corteCaja.id),
    cancelado: boolean().notNull().default(false),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.sucursalId, t.corteId)],
);

export const movimientoCaja = pgTable(
  "movimiento_caja",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    sucursalId: uuid()
      .notNull()
      .references(() => sucursal.id),
    tipo: text({ enum: ["ingreso", "egreso", "fondo"] }).notNull(),
    categoria: text().notNull(),
    concepto: text().notNull(),
    metodo: text({ enum: METODOS_PAGO }).notNull().default("efectivo"),
    monto: integer().notNull(),
    ventaId: uuid().references(() => venta.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    corteId: uuid().references(() => corteCaja.id),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.sucursalId, t.corteId)],
);
