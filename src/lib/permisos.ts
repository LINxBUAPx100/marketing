// Catálogo de permisos. Cada permiso es "modulo.accion".
// Se agregan módulos aquí conforme se construyen las fases.

export type Accion = { clave: string; etiqueta: string };
export type ModuloPermisos = { clave: string; etiqueta: string; acciones: Accion[] };

const ver = { clave: "ver", etiqueta: "Ver" };
const crear = { clave: "crear", etiqueta: "Crear" };
const editar = { clave: "editar", etiqueta: "Editar" };
const cancelar = { clave: "cancelar", etiqueta: "Cancelar" };

export const MODULOS_PERMISOS: ModuloPermisos[] = [
  { clave: "ventas", etiqueta: "Ventas", acciones: [ver, crear, cancelar, { clave: "descuento", etiqueta: "Dar descuentos" }] },
  { clave: "cotizaciones", etiqueta: "Cotizaciones", acciones: [ver, crear, editar, cancelar] },
  { clave: "produccion", etiqueta: "Producción", acciones: [ver, { clave: "editar", etiqueta: "Mover y asignar órdenes" }, { clave: "etapas", etiqueta: "Configurar etapas" }] },
  { clave: "caja", etiqueta: "Caja", acciones: [ver, { clave: "movimientos", etiqueta: "Ingresos y egresos" }, { clave: "corte", etiqueta: "Hacer corte" }, { clave: "todas", etiqueta: "Ver todas las sucursales" }] },
  { clave: "clientes", etiqueta: "Clientes", acciones: [ver, crear, editar] },
  { clave: "cxc", etiqueta: "Cuentas por cobrar", acciones: [ver, { clave: "abonar", etiqueta: "Registrar abonos" }] },
  { clave: "productos", etiqueta: "Productos", acciones: [ver, crear, editar, { clave: "costos", etiqueta: "Ver costos" }] },
  { clave: "insumos", etiqueta: "Insumos", acciones: [ver, crear, editar] },
  { clave: "almacen", etiqueta: "Almacén", acciones: [ver, { clave: "ajustar", etiqueta: "Ajustar existencias" }, { clave: "traspasar", etiqueta: "Traspasar" }] },
  { clave: "cxp", etiqueta: "Cuentas por pagar", acciones: [ver, crear, { clave: "pagar", etiqueta: "Registrar pagos" }] },
  { clave: "maquinas", etiqueta: "Máquinas y contadores", acciones: [ver, editar, { clave: "lecturas", etiqueta: "Capturar lecturas" }, { clave: "mermas", etiqueta: "Registrar mermas" }] },
  { clave: "consumibles", etiqueta: "Consumibles", acciones: [ver, editar] },
  { clave: "comisiones", etiqueta: "Comisiones", acciones: [ver, { clave: "pagar", etiqueta: "Marcar pagadas" }] },
  { clave: "convenios", etiqueta: "Convenios", acciones: [ver, editar] },
  { clave: "facturacion", etiqueta: "Facturación", acciones: [ver, { clave: "timbrar", etiqueta: "Timbrar" }, cancelar] },
  { clave: "reportes", etiqueta: "Reportes", acciones: [ver] },
  { clave: "negocio", etiqueta: "Datos del negocio", acciones: [ver, editar] },
  { clave: "sucursales", etiqueta: "Sucursales", acciones: [ver, editar] },
  { clave: "usuarios", etiqueta: "Usuarios", acciones: [ver, editar] },
  { clave: "roles", etiqueta: "Roles", acciones: [ver, editar] },
  { clave: "bitacora", etiqueta: "Bitácora", acciones: [ver] },
];

export const TODOS_LOS_PERMISOS = MODULOS_PERMISOS.flatMap((m) =>
  m.acciones.map((a) => `${m.clave}.${a.clave}`),
);

const p = (...claves: string[]) => claves;

// Roles que se crean al configurar el negocio por primera vez.
export const ROLES_INICIALES = [
  { nombre: "Administrador", descripcion: "Acceso total al sistema", esAdmin: true, permisos: [] as string[] },
  {
    nombre: "Vendedor",
    descripcion: "Mostrador: ventas, cotizaciones, clientes y caja",
    esAdmin: false,
    permisos: p(
      "ventas.ver", "ventas.crear",
      "cotizaciones.ver", "cotizaciones.crear", "cotizaciones.editar", "cotizaciones.cancelar",
      "produccion.ver",
      "caja.ver", "caja.movimientos",
      "clientes.ver", "clientes.crear", "clientes.editar",
      "cxc.ver", "cxc.abonar",
      "productos.ver",
    ),
  },
  {
    nombre: "Producción",
    descripcion: "Taller: órdenes, máquinas, mermas y consumibles",
    esAdmin: false,
    permisos: p(
      "produccion.ver", "produccion.editar",
      "maquinas.ver", "maquinas.lecturas", "maquinas.mermas",
      "consumibles.ver",
      "insumos.ver", "almacen.ver",
    ),
  },
];
