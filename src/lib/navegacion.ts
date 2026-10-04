import {
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Droplet,
  FileSpreadsheet,
  FileText,
  Handshake,
  History,
  House,
  Layers,
  type LucideIcon,
  Package,
  Percent,
  Printer,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
  UserRound,
  Wallet,
} from "lucide-react";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  /** Permiso necesario para verlo; sin permiso = todos los usuarios. */
  permiso?: string;
  /** Fase del plan en que se construye. Si está, el módulo aún no existe. */
  fase?: number;
};

export type GrupoNav = { titulo: string; items: ItemNav[] };

export const NAVEGACION: GrupoNav[] = [
  {
    titulo: "Operación",
    items: [
      { href: "/", etiqueta: "Inicio", icono: House },
      { href: "/ventas", etiqueta: "Ventas", icono: ShoppingCart, permiso: "ventas.ver" },
      { href: "/cotizaciones", etiqueta: "Cotizaciones", icono: FileText, permiso: "cotizaciones.ver" },
      { href: "/produccion", etiqueta: "Producción", icono: ClipboardList, permiso: "produccion.ver" },
      { href: "/caja", etiqueta: "Caja", icono: Wallet, permiso: "caja.ver" },
    ],
  },
  {
    titulo: "Clientes",
    items: [
      { href: "/clientes", etiqueta: "Clientes", icono: UserRound, permiso: "clientes.ver" },
      { href: "/cuentas-por-cobrar", etiqueta: "Cuentas por cobrar", icono: Banknote, permiso: "cxc.ver" },
      { href: "/convenios", etiqueta: "Convenios", icono: Handshake, permiso: "convenios.ver", fase: 5 },
    ],
  },
  {
    titulo: "Inventario",
    items: [
      { href: "/productos", etiqueta: "Productos", icono: Package, permiso: "productos.ver" },
      { href: "/insumos", etiqueta: "Insumos", icono: Layers, permiso: "insumos.ver" },
      { href: "/almacen", etiqueta: "Almacén", icono: Boxes, permiso: "almacen.ver" },
      { href: "/cuentas-por-pagar", etiqueta: "Cuentas por pagar", icono: Receipt, permiso: "cxp.ver" },
    ],
  },
  {
    titulo: "Taller",
    items: [
      { href: "/maquinas", etiqueta: "Máquinas y contadores", icono: Printer, permiso: "maquinas.ver" },
      { href: "/consumibles", etiqueta: "Consumibles", icono: Droplet, permiso: "consumibles.ver" },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/comisiones", etiqueta: "Comisiones", icono: Percent, permiso: "comisiones.ver", fase: 5 },
      { href: "/facturacion", etiqueta: "Facturación", icono: FileSpreadsheet, permiso: "facturacion.ver", fase: 6 },
      { href: "/reportes", etiqueta: "Reportes", icono: BarChart3, permiso: "reportes.ver", fase: 7 },
    ],
  },
  {
    titulo: "Configuración",
    items: [
      { href: "/configuracion/negocio", etiqueta: "Negocio", icono: Building2, permiso: "negocio.ver" },
      { href: "/configuracion/sucursales", etiqueta: "Sucursales", icono: Store, permiso: "sucursales.ver" },
      { href: "/configuracion/usuarios", etiqueta: "Usuarios", icono: Users, permiso: "usuarios.ver" },
      { href: "/configuracion/roles", etiqueta: "Roles y permisos", icono: ShieldCheck, permiso: "roles.ver" },
      { href: "/configuracion/bitacora", etiqueta: "Bitácora", icono: History, permiso: "bitacora.ver" },
    ],
  },
];
