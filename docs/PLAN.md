# Sistema de administración para imprenta — Plan maestro

> Objetivo: construir desde cero una web que cubra **todas** las funciones de AdmiPrint (Octana Software),
> adaptada a la imprenta propia. Se replica la *funcionalidad*, no la marca, el diseño ni el código.

---

## 1. Lo que hace AdmiPrint (investigación)

Fuentes: admiprint.com (landing, términos), ficha de App Store / Google Play (v1.5, ago-2025).
El panel (`panel.admiprint.com`) requiere cuenta; lo que sigue sale de lo que publican.

| Módulo | Funciones publicadas |
|---|---|
| **Ventas (POS)** | Ventas rápidas · cobro en parcialidades (anticipos) · pagos en efectivo, tarjeta, cheque y depósito/transferencia · notas de venta · consulta de ventas canceladas · precios para revendedores |
| **Cotizaciones** | Crear y enviar cotizaciones · programar seguimientos · convertir cotización → venta |
| **Caja** | Ingresos y egresos · cortes diarios y/o semanales · gastos por categoría · histórico de caja · estado de caja de todas las sucursales |
| **Productos** | Alta con precio, imagen, categoría y existencias |
| **Insumos** | Catálogo de insumos (papel, tinta, vinil…) · productos compuestos por 1+ insumos (receta) · costo por producto/insumo |
| **Almacén** | Inventario de productos e insumos · existencias y costos · traspasos entre sucursales · cálculo de utilidad |
| **Producción** | Estatus de cada orden · fecha compromiso · pedidos por vencer y retrasados · responsable por etapa · último usuario que intervino · saber si ya se entregó · detectar qué proceso falla |
| **Máquinas y contadores** | Registro de equipos · lectura de contadores · impresiones por equipo · errores y mermas por equipo y por usuario · evitar "impresiones fantasma" (contador vs. lo vendido) |
| **Consumibles** | Rendimiento (tóner, drums…) · fecha de reposición · qué equipo consume más |
| **Comisiones** | % de comisión por usuario · cálculo automático |
| **Clientes** | Catálogo de clientes · **cuentas por cobrar** · **convenios** (precios/condiciones especiales por cliente) |
| **Cuentas por pagar** | Proveedores · deudas y fechas de pago · registro de pagos |
| **Facturación CFDI 4.0** | Facturar ventas · complementos de pago · cancelación · (timbre ~$1.50 por folio con su PAC) |
| **WhatsApp** | Enviar notas de venta, cotizaciones y facturas · avisar al cliente que su pedido está listo |
| **Plataforma** | Multi-sucursal en tiempo real · usuarios ilimitados · roles ilimitados con permisos · PC/Mac/tablet + app iOS/Android · notificaciones en tiempo real · exportación a Excel de catálogos |

Planes de referencia: Básico $348/mes (3 sucursales), Avanzado $580/mes (5 sucursales, todo lo anterior).
Hacer el sistema propio se paga solo frente a ~$7,000 MXN/año, pero exige mantenerlo.

---

## 2. Decisiones de arquitectura

**Alcance:** un solo negocio con varias sucursales (no un SaaS para vender a otras imprentas).
Igual se pone `negocio_id` en todas las tablas para que convertirlo en SaaS después sea posible.

| Capa | Elección | Por qué |
|---|---|---|
| Frontend + backend | **Next.js 15 (App Router) + TypeScript** | Un solo proyecto, server actions, buen soporte |
| UI | **Tailwind + shadcn/ui** | Tablas, formularios y diálogos listos; usable en tablet |
| Base de datos | **PostgreSQL en Supabase** (producción) · **PGlite** (desarrollo local) | Realtime, storage de imágenes y backups incluidos; PGlite evita instalar Docker o Postgres |
| ORM / validación | **Drizzle ORM + Zod** | Migraciones tipadas |
| Tiempo real | Supabase Realtime | Tablero de producción y cajas de sucursales en vivo |
| Móvil | **PWA** instalable (fase 1); app nativa solo si hace falta | Evita publicar en tiendas |
| PDF | `@react-pdf/renderer` | Notas, cotizaciones, órdenes de trabajo, cortes |
| Facturación | PAC con API: **Facturapi** o **Facturama** | Ellos timbran y cancelan; nosotros mandamos JSON |
| WhatsApp | Fase 1: enlaces `wa.me` con mensaje y PDF · Fase 2: **WhatsApp Cloud API** (Meta) con plantillas | Lo primero es gratis e inmediato |
| Impresión de tickets | Impresora térmica 58/80 mm vía impresión del navegador (o QZ Tray) | |
| Hosting | Vercel (app) + Supabase (BD) | Costo inicial ~$0–25 USD/mes |
| Pruebas | Vitest (lógica) + Playwright (flujos POS) | |

Acceso: sesiones propias (contraseña con bcrypt + cookie httpOnly) y roles con permisos `modulo.accion`, sin depender del Auth de Supabase.

Reglas transversales: dinero en centavos (enteros), IVA configurable, zona horaria `America/Mexico_City`,
toda operación registra `usuario_id`, `sucursal_id` y fecha (auditoría); nada se borra, se cancela.

---

## 3. Modelo de datos (resumen)

```
negocio ─┬─ sucursal ─┬─ caja ── movimiento_caja (ingreso/egreso, categoría)
         │            │        └ corte_caja
         │            └─ existencia (producto|insumo, cantidad, costo_promedio)
         ├─ usuario ── rol ── permiso[]        (usuario.comision_pct)
         ├─ cliente ── convenio (lista de precios / descuento / crédito)
         ├─ proveedor ── cuenta_por_pagar ── pago_proveedor
         ├─ categoria ── producto ── receta_insumo (insumo, cantidad)
         │                      └ precio (público | revendedor | convenio, por volumen)
         ├─ insumo
         ├─ cotizacion ── cotizacion_partida ── seguimiento
         ├─ venta ── venta_partida ── orden_produccion ── etapa_produccion (responsable, estatus)
         │       ├─ pago (método, monto)  → cuentas por cobrar = total − pagos
         │       └─ factura (uuid, xml, pdf, estatus) ── complemento_pago
         ├─ maquina ── lectura_contador ── merma (usuario, motivo, cantidad)
         │         └─ consumible_instalado (fecha, rendimiento esperado/real)
         ├─ traspaso ── traspaso_partida
         ├─ comision (venta, usuario, monto, pagada)
         ├─ notificacion · mensaje_whatsapp · bitacora_auditoria
```

---

## 4. Plan por fases

Cada fase termina con algo que la imprenta ya puede usar en el mostrador.

### Fase 0 — Cimientos (1 semana) ✅ terminada
- Proyecto Next.js, Supabase, Drizzle, shadcn, despliegue en Vercel.
- Login, usuarios, **roles y permisos** granulares (ver/crear/editar/cancelar por módulo).
- Sucursales y selector de sucursal activa. Configuración del negocio (logo, RFC, IVA, folios).
- Layout responsivo para tablet, bitácora de auditoría.

### Fase 1 — Punto de venta básico (2–3 semanas) → equivale al plan *Básico* ✅ terminada
- **Productos y categorías** con imagen, precio público y precio revendedor; servicios sin inventario.
- **Clientes**: catálogo, búsqueda rápida, historial.
- **Ventas**: carrito, descuentos, varios métodos de pago en una misma venta, **anticipos/parcialidades**,
  nota de venta en PDF y ticket térmico, cancelación con motivo y consulta de canceladas.
- **Cuentas por cobrar**: saldos pendientes por cliente, abonos.
- **Caja**: apertura, ingresos/egresos con categoría, **corte diario/semanal**, histórico,
  vista de todas las sucursales.
- WhatsApp fase 1: botón "enviar nota" (enlace `wa.me` + link al PDF).

### Fase 2 — Producción y cotizaciones (2 semanas) ✅ terminada
- **Cotizaciones**: crear, PDF, enviar por WhatsApp/correo, vigencia, **seguimientos programados**
  (recordatorio al vendedor), convertir en venta con un clic.
- **Órdenes de producción** generadas al vender: etapas configurables
  (diseño → impresión → acabado → listo → entregado), responsable por etapa, fecha compromiso.
- **Tablero kanban en tiempo real**: por vencer, retrasados, último usuario que movió la orden.
- Aviso "tu pedido está listo" por WhatsApp. Notificaciones internas en tiempo real.
- Reporte de cuellos de botella (tiempo promedio por etapa).

### Fase 3 — Insumos, almacén y costos (2 semanas) ✅ terminada
- **Insumos** con unidad y costo; **recetas** (producto = N insumos); descuento automático al vender.
- **Almacén** por sucursal: entradas, ajustes, **traspasos entre sucursales**, alertas de mínimo.
- Costo por producto y **utilidad** por venta/periodo.
- **Proveedores y cuentas por pagar**: compras, vencimientos, pagos, alertas.

### Fase 4 — Máquinas, contadores y consumibles (1–2 semanas) ✅ terminada
- Registro de equipos por sucursal.
- **Lecturas de contador** (inicio/fin de día). Impresiones por equipo = diferencia de lecturas.
- **Detector de impresiones fantasma**: impresiones del contador − (impresiones vendidas + mermas registradas).
- **Mermas** por equipo y por usuario con motivo.
- **Consumibles**: instalación, rendimiento esperado vs. real, fecha de reposición, ranking de consumo.

### Fase 5 — Comisiones, convenios y precios avanzados (1 semana) ✅ terminada
- % de comisión por usuario (opcional por categoría), cálculo por periodo, marcar pagadas.
- **Convenios** con clientes: lista de precios especial, descuento, días de crédito, límite de crédito.
- Precios por volumen (ej. 1–99, 100–499, 500+ volantes).

### Fase 6 — Facturación CFDI 4.0 (1–2 semanas) ✅ terminada (en simulación hasta tener PAC y CSD)
- Datos fiscales del cliente (RFC, régimen, uso CFDI, CP) y claves SAT por producto.
- Facturar una o varias ventas, factura global al público en general.
- **Complementos de pago** (PPD), **cancelación** con motivo SAT, envío de XML+PDF.
- Integración con PAC (Facturapi/Facturama) en modo pruebas primero; requiere CSD del SAT de la imprenta.

### Fase 7 — WhatsApp API, reportes y pulido (1–2 semanas)
- WhatsApp Cloud API: plantillas aprobadas para nota, cotización, factura y pedido listo; envío automático.
- Dashboard: ventas del día/mes, por sucursal, por vendedor, productos top, pedidos hoy.
- Exportar a Excel (clientes, productos, insumos, ventas, facturas, proveedores, usuarios).
- PWA instalable, modo offline básico para cobrar si cae el internet (cola de sincronización).
- Respaldos automáticos y restauración probada.

**Total estimado:** 12–16 semanas de trabajo a tiempo parcial con ayuda de Claude.

---

## 5. Lo que necesitamos de la imprenta antes de empezar
1. Lista de productos/servicios reales con precios (público y revendedor).
2. Etapas reales de producción y quién hace cada una.
3. Máquinas que tienen (marca/modelo) y cómo leen hoy los contadores.
4. Número de sucursales y usuarios, y qué puede ver cada uno.
5. Si ya facturan: RFC, régimen y si tienen CSD; qué PAC usan (si alguno).
6. Número de WhatsApp del negocio (para la API debe ser una línea dedicada).

## 6. Riesgos
- **Facturación**: es la parte con consecuencias legales; se prueba en sandbox y se valida con su contador.
- **Mantenimiento**: el sistema propio necesita alguien que lo actualice y respalde.
- **WhatsApp API**: Meta cobra por conversación y exige plantillas aprobadas; por eso la fase 1 usa enlaces.
