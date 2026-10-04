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
    // Si al venderlo se genera una orden para el taller.
    requiereProduccion: boolean().notNull().default(false),
    // Cuántas impresiones de qué tipo gasta UNA unidad (para comparar contra los contadores).
    tipoImpresion: text({ enum: ["byn", "color", "gran_formato"] }),
    impresionesPorUnidad: cantidad().notNull().default(0),
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
  motivo: text({ enum: ["inicial", "ajuste", "venta", "cancelacion", "compra", "traspaso", "compra_cancelada"] }).notNull(),
  ventaId: uuid(),
  compraId: uuid(),
  traspasoId: uuid(),
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
  // Costo total de la partida al venderla (receta de insumos o costo del producto). Null = sin costo conocido.
  costo: integer(),
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

// ─── Fase 2: producción ─────────────────────────────────────────────────────

// Etapas configurables por negocio. "listo" avisa al cliente; "entregado" cierra la orden.
export const etapaProduccion = pgTable("etapa_produccion", {
  id: uuid().primaryKey().defaultRandom(),
  negocioId: uuid()
    .notNull()
    .references(() => negocio.id),
  nombre: text().notNull(),
  orden: integer().notNull(),
  tipo: text({ enum: ["proceso", "listo", "entregado"] }).notNull().default("proceso"),
  // Quién la toma por omisión cuando una orden llega a esta etapa.
  responsableId: uuid().references(() => usuario.id),
  activa: boolean().notNull().default(true),
  creadoEn: creadoEn(),
});

export const ordenProduccion = pgTable(
  "orden_produccion",
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
    etapaId: uuid()
      .notNull()
      .references(() => etapaProduccion.id),
    responsableId: uuid().references(() => usuario.id),
    fechaCompromiso: timestamp({ withTimezone: true }),
    estado: text({ enum: ["activa", "entregada", "cancelada"] }).notNull().default("activa"),
    notas: text(),
    actualizadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actualizadoPor: uuid().references(() => usuario.id),
    entregadaEn: timestamp({ withTimezone: true }),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex().on(t.ventaId), index().on(t.negocioId, t.estado)],
);

// Historial: cada cambio de etapa o de responsable. Sirve para medir cuánto tarda cada etapa.
export const ordenEvento = pgTable(
  "orden_evento",
  {
    id: uuid().primaryKey().defaultRandom(),
    ordenId: uuid()
      .notNull()
      .references(() => ordenProduccion.id),
    etapaId: uuid()
      .notNull()
      .references(() => etapaProduccion.id),
    responsableId: uuid().references(() => usuario.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    nota: text(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.ordenId, t.creadoEn)],
);

export const notificacion = pgTable(
  "notificacion",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    titulo: text().notNull(),
    mensaje: text(),
    enlace: text(),
    leida: boolean().notNull().default(false),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.usuarioId, t.leida)],
);

// ─── Fase 2: cotizaciones ───────────────────────────────────────────────────

export const cotizacion = pgTable(
  "cotizacion",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    sucursalId: uuid()
      .notNull()
      .references(() => sucursal.id),
    folio: text().notNull(),
    clienteId: uuid()
      .notNull()
      .references(() => cliente.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    subtotal: integer().notNull(),
    descuento: integer().notNull().default(0),
    iva: integer().notNull(),
    total: integer().notNull(),
    vigenciaHasta: timestamp({ withTimezone: true }).notNull(),
    // "vencida" no se guarda: se calcula con la vigencia.
    estado: text({ enum: ["abierta", "aceptada", "rechazada", "cancelada"] }).notNull().default("abierta"),
    motivoRechazo: text(),
    ventaId: uuid().references(() => venta.id),
    notas: text(),
    condiciones: text(),
    actualizadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex().on(t.sucursalId, t.folio), index().on(t.negocioId, t.creadoEn)],
);

export const cotizacionPartida = pgTable("cotizacion_partida", {
  id: uuid().primaryKey().defaultRandom(),
  cotizacionId: uuid()
    .notNull()
    .references(() => cotizacion.id),
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

export const seguimiento = pgTable(
  "seguimiento",
  {
    id: uuid().primaryKey().defaultRandom(),
    cotizacionId: uuid()
      .notNull()
      .references(() => cotizacion.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    fecha: timestamp({ withTimezone: true }).notNull(),
    nota: text().notNull(),
    hechoEn: timestamp({ withTimezone: true }),
    resultado: text(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.usuarioId, t.hechoEn)],
);

// ─── Fase 3: insumos, recetas y almacén ─────────────────────────────────────

// Costo en centavos por unidad, con decimales: una hoja puede costar 18.5 centavos.
const costoUnitario = () => numeric({ precision: 14, scale: 4, mode: "number" });

export const insumo = pgTable(
  "insumo",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    nombre: text().notNull(),
    codigo: text(),
    unidad: text().notNull(),
    costo: costoUnitario().notNull().default(0),
    existenciaMinima: cantidad().notNull().default(0),
    proveedorId: uuid(),
    activo: boolean().notNull().default(true),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.negocioId, t.nombre)],
);

export const existenciaInsumo = pgTable(
  "existencia_insumo",
  {
    insumoId: uuid()
      .notNull()
      .references(() => insumo.id),
    sucursalId: uuid()
      .notNull()
      .references(() => sucursal.id),
    cantidad: cantidad().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.insumoId, t.sucursalId] })],
);

export const MOTIVOS_INSUMO = ["inicial", "ajuste", "compra", "consumo", "cancelacion", "traspaso", "compra_cancelada"] as const;

export const movimientoInsumo = pgTable(
  "movimiento_insumo",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    sucursalId: uuid()
      .notNull()
      .references(() => sucursal.id),
    insumoId: uuid()
      .notNull()
      .references(() => insumo.id),
    cantidad: cantidad().notNull(),
    motivo: text({ enum: MOTIVOS_INSUMO }).notNull(),
    ventaId: uuid(),
    compraId: uuid(),
    traspasoId: uuid(),
    usuarioId: uuid().references(() => usuario.id),
    nota: text(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.insumoId, t.creadoEn)],
);

// Cuánto de cada insumo lleva UNA unidad del producto (p. ej. 1 millar de volantes = 250 hojas).
export const receta = pgTable(
  "receta",
  {
    productoId: uuid()
      .notNull()
      .references(() => producto.id),
    insumoId: uuid()
      .notNull()
      .references(() => insumo.id),
    cantidad: cantidad().notNull(),
  },
  (t) => [primaryKey({ columns: [t.productoId, t.insumoId] })],
);

// ─── Fase 3: proveedores, compras y cuentas por pagar ───────────────────────

export const proveedor = pgTable("proveedor", {
  id: uuid().primaryKey().defaultRandom(),
  negocioId: uuid()
    .notNull()
    .references(() => negocio.id),
  nombre: text().notNull(),
  contacto: text(),
  telefono: text(),
  correo: text(),
  rfc: text(),
  diasCredito: integer().notNull().default(0),
  notas: text(),
  activo: boolean().notNull().default(true),
  creadoEn: creadoEn(),
});

export const compra = pgTable(
  "compra",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    sucursalId: uuid()
      .notNull()
      .references(() => sucursal.id),
    proveedorId: uuid()
      .notNull()
      .references(() => proveedor.id),
    // Folio de la factura o nota del proveedor.
    referencia: text(),
    fecha: timestamp({ withTimezone: true }).notNull(),
    vencimiento: timestamp({ withTimezone: true }).notNull(),
    total: integer().notNull(),
    pagado: integer().notNull().default(0),
    estado: text({ enum: ["activa", "cancelada"] }).notNull().default("activa"),
    notas: text(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    motivoCancelacion: text(),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.negocioId, t.vencimiento)],
);

// Cada partida es un insumo o un producto de reventa (uno de los dos).
export const compraPartida = pgTable("compra_partida", {
  id: uuid().primaryKey().defaultRandom(),
  compraId: uuid()
    .notNull()
    .references(() => compra.id),
  insumoId: uuid().references(() => insumo.id),
  productoId: uuid().references(() => producto.id),
  cantidad: cantidad().notNull(),
  costoUnitario: costoUnitario().notNull(),
  importe: integer().notNull(),
});

export const pagoProveedor = pgTable("pago_proveedor", {
  id: uuid().primaryKey().defaultRandom(),
  negocioId: uuid()
    .notNull()
    .references(() => negocio.id),
  compraId: uuid()
    .notNull()
    .references(() => compra.id),
  metodo: text({ enum: METODOS_PAGO }).notNull(),
  monto: integer().notNull(),
  referencia: text(),
  // Si salió de la caja de una sucursal, el gasto queda registrado ahí.
  movimientoCajaId: uuid().references(() => movimientoCaja.id),
  usuarioId: uuid()
    .notNull()
    .references(() => usuario.id),
  creadoEn: creadoEn(),
});

export const traspaso = pgTable("traspaso", {
  id: uuid().primaryKey().defaultRandom(),
  negocioId: uuid()
    .notNull()
    .references(() => negocio.id),
  folio: text().notNull(),
  origenId: uuid()
    .notNull()
    .references(() => sucursal.id),
  destinoId: uuid()
    .notNull()
    .references(() => sucursal.id),
  notas: text(),
  usuarioId: uuid()
    .notNull()
    .references(() => usuario.id),
  creadoEn: creadoEn(),
});

export const traspasoPartida = pgTable("traspaso_partida", {
  id: uuid().primaryKey().defaultRandom(),
  traspasoId: uuid()
    .notNull()
    .references(() => traspaso.id),
  insumoId: uuid().references(() => insumo.id),
  productoId: uuid().references(() => producto.id),
  cantidad: cantidad().notNull(),
});

// ─── Fase 4: máquinas, contadores, mermas y consumibles ─────────────────────

export const TIPOS_IMPRESION = ["byn", "color", "gran_formato"] as const;

export const maquina = pgTable("maquina", {
  id: uuid().primaryKey().defaultRandom(),
  negocioId: uuid()
    .notNull()
    .references(() => negocio.id),
  sucursalId: uuid()
    .notNull()
    .references(() => sucursal.id),
  nombre: text().notNull(),
  marca: text(),
  modelo: text(),
  serie: text(),
  notas: text(),
  activa: boolean().notNull().default(true),
  creadoEn: creadoEn(),
});

// Una máquina puede tener varios contadores: negro, color, metros…
export const contador = pgTable("contador", {
  id: uuid().primaryKey().defaultRandom(),
  maquinaId: uuid()
    .notNull()
    .references(() => maquina.id),
  nombre: text().notNull(),
  tipo: text({ enum: TIPOS_IMPRESION }).notNull(),
  activo: boolean().notNull().default(true),
});

export const lecturaContador = pgTable(
  "lectura_contador",
  {
    id: uuid().primaryKey().defaultRandom(),
    contadorId: uuid()
      .notNull()
      .references(() => contador.id),
    valor: cantidad().notNull(),
    momento: text({ enum: ["apertura", "cierre", "otra"] }).notNull().default("otra"),
    nota: text(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.contadorId, t.creadoEn)],
);

export const MOTIVOS_MERMA = ["atasco", "prueba", "error_impresion", "error_diseno", "defecto_material", "otro"] as const;

export const merma = pgTable(
  "merma",
  {
    id: uuid().primaryKey().defaultRandom(),
    negocioId: uuid()
      .notNull()
      .references(() => negocio.id),
    maquinaId: uuid()
      .notNull()
      .references(() => maquina.id),
    tipo: text({ enum: TIPOS_IMPRESION }).notNull(),
    cantidad: cantidad().notNull(),
    motivo: text({ enum: MOTIVOS_MERMA }).notNull(),
    // Quién la provocó (puede ser distinto de quien la registra).
    responsableId: uuid().references(() => usuario.id),
    ventaId: uuid().references(() => venta.id),
    nota: text(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    creadoEn: creadoEn(),
  },
  (t) => [index().on(t.negocioId, t.creadoEn)],
);

export const consumible = pgTable("consumible", {
  id: uuid().primaryKey().defaultRandom(),
  maquinaId: uuid()
    .notNull()
    .references(() => maquina.id),
  // El contador con el que se mide su desgaste.
  contadorId: uuid()
    .notNull()
    .references(() => contador.id),
  nombre: text().notNull(),
  rendimiento: integer().notNull(),
  costo: integer(),
  // Si sale del almacén, se descuenta una pieza de este insumo al instalarlo.
  insumoId: uuid().references(() => insumo.id),
  lecturaInstalacion: cantidad().notNull(),
  instaladoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lecturaRetiro: cantidad(),
  retiradoEn: timestamp({ withTimezone: true }),
  usuarioId: uuid()
    .notNull()
    .references(() => usuario.id),
  creadoEn: creadoEn(),
});
