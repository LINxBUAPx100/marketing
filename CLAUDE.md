@AGENTS.md

# Sistema de administración para imprenta

Plan completo y fases: `docs/PLAN.md` (versión visual: `docs/plan.html`). Todo el código, la UI y los mensajes están en español de México.

## Comandos

- `npm run dev` — servidor de desarrollo en http://localhost:3000
- `npm run db:generar` — genera una migración en `drizzle/` después de cambiar `src/db/schema.ts`
- `npm run db:migrar` — aplica migraciones
- `npm run db:demo` — carga datos de ejemplo (accesos en `scripts/datos-demo.mts`)
- `npm run db:reiniciar` — borra la base local (`.data/pglite`, no los respaldos) y la recrea con datos de ejemplo
- `npm run db:respaldar` / `npm run db:restaurar -- archivo.json.gz [--reemplazar]` — respaldo completo y restauración (servidor detenido)
- `npm test` (Vitest: lógica de dinero en `src/lib/**/*.test.ts`), `npm run typecheck`, `npx eslint src scripts`, `npm run build`
- El modo sin conexión solo funciona con `npm run build && npm run start` (en desarrollo el service worker se desregistra)

## Base de datos

- Sin `DATABASE_URL`: PGlite (PostgreSQL embebido) en `.data/pglite`. Con `postgres://…`: PostgreSQL real (Supabase en producción).
- **PGlite admite un solo proceso.** Detén `npm run dev` antes de correr scripts `db:*` o `npm run build`; si no, la base local se daña.
- `src/db/index.ts` abre la conexión en la primera consulta, no al importar (el build carga módulos en varios procesos).
- Dinero en centavos (`integer`), porcentajes en puntos base (1600 = 16 %). Helpers en `src/lib/numeros.ts`.
- Nada se borra: se desactiva o se cancela. Todas las tablas cuelgan de `negocio`.

## Convenciones

- Next.js 16: `proxy.ts` (antes middleware), `params`/`cookies()` son async. Lee `node_modules/next/dist/docs/` antes de usar una API.
- shadcn/ui sobre **Base UI** (no Radix): se usa `render={<Link …/>}` en vez de `asChild`, y `nativeButton={false}` cuando un `Button` renderiza un enlace.
- Autorización: páginas con `requerirPermiso("modulo.accion")`; acciones con `sesion.puede(...)` y regresan `{ mensaje }` si falta. Catálogo en `src/lib/permisos.ts`.
- Cada cambio de datos llama a `registrar()` (`src/lib/bitacora.ts`).
- Formularios: acción de servidor `(estado, formData) => EstadoFormulario` validada con Zod; en el cliente `useFormulario` (`src/hooks/use-formulario.ts`), que no vacía el formulario cuando hay errores. Diálogos con `DialogoFormulario`; como reciben una función, se escriben en un componente de cliente propio del módulo.
- Menú: `src/lib/navegacion.ts`. Al terminar un módulo, quita su `fase` para activarlo.
- Lógica de dinero en funciones puras con pruebas: `src/lib/ventas/calculo.ts` (totales, IVA, pagos) y `src/lib/caja/resumen.ts` (periodo de caja). El servidor recalcula todo; el navegador solo propone.
- Ventas: `src/lib/ventas/servidor.ts` (crear, abonar, cancelar). Folios por sucursal con `siguienteFolio`. Inventario siempre con `moverExistencia` (deja movimiento).
- Caja: un periodo es todo lo que tiene `corteId` nulo en la sucursal. Cancelar una venta cuyo pago ya entró a un corte genera un egreso "Devolución".
- Fechas en hora de México: `src/lib/fechas.ts`.
- Catálogo y partidas compartidos por punto de venta y cotizaciones: `src/components/ventas/partidas.tsx` (`usePartidas`, `Catalogo`, `ListaPartidas`).
- Producción: reglas puras en `src/lib/produccion/reglas.ts` (urgencia, tiempo por etapa); servidor en `src/lib/produccion/servidor.ts`. Las órdenes nacen dentro de la transacción de la venta (`crearOrden`), cada cambio deja `ordenEvento` y avisa con `notificar`.
- "Tiempo real" = `AutoRefresco` (router.refresh cada N s con la pestaña visible). Funciona igual en Vercel; Supabase Realtime es opcional después.
- Almacén: movimientos de stock y folios en `src/lib/almacen/existencias.ts` (`moverExistencia`, `moverInsumo`, `siguienteFolio`); compras, pagos a proveedor y traspasos en `src/lib/almacen/servidor.ts`; reglas puras (costo por receta, consumo, utilidad sin IVA, estado de cuentas por pagar) en `src/lib/almacen/reglas.ts`.
- Costos de insumos en centavos con decimales (`numeric`, 72.5 = $0.725). Cada `venta_partida` guarda su `costo` al venderse; la utilidad se calcula sin IVA. Las ventas anteriores a la fase 3 no tienen costo.
- Al vender se descuentan los insumos de la receta (`motivo: "consumo"`); al cancelar se regresan.
- Máquinas: reglas puras en `src/lib/maquinas/reglas.ts` (impresiones de un periodo desde lecturas, fantasma, desgaste de consumibles). Fantasma por tipo de impresión (byn, color, gran formato) = contador − (ventas × `impresionesPorUnidad` del producto) − mermas.
- Precios: una sola regla en `src/lib/ventas/precios.ts` (`precioPara`): precio especial del convenio > escalón de volumen > lista, y luego descuento del convenio. La usan el navegador (`usePartidas`) y el servidor (`crearVenta`, `guardarCotizacion`) con datos de `src/lib/ventas/reglas-cliente.ts`.
- Comisiones: una fila por partida al vender (base sin IVA × % de la categoría o del vendedor); se pagan solo si la venta está cobrada (`src/lib/comisiones/servidor.ts`).
- Facturación: `src/lib/facturacion/pac.ts` elige el PAC. Con `FACTURAPI_KEY` usa Facturapi (sk_test_ = pruebas, sk_live_ = real); sin llave usa el simulador (facturas `simulada = true`, SIN validez fiscal). Reglas puras (PUE/PPD, forma de pago, validación del receptor, complementos) en `src/lib/facturacion/reglas.ts`.
- Una venta con factura vigente no se cancela; una factura con complementos vigentes tampoco.
- En desarrollo, editar archivos con `npm run dev` corriendo puede recargar el panel del navegador hacia "/" (recarga en caliente); no es un error de la app.
- Si `npm run dev` lo arrancó otra persona, no corras `db:*` encima: PGlite se daña con dos procesos.
- Imágenes: `src/lib/archivos.ts` guarda en `.data/archivos` (solo desarrollo). Para producción hay que cambiarlo a Supabase Storage.
- WhatsApp: plantillas en `src/lib/mensajes/plantillas.ts` (deben existir aprobadas en Meta con el mismo nombre y orden de variables). Con `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` se envían por la API de Meta; sin ellos se registran como `simulado` y los botones abren wa.me. Los avisos automáticos se disparan con `after()` desde las acciones (`avisoAutomatico`) y nunca deben tumbar la operación. Bitácora en `mensaje_whatsapp`.
- Reportes: consultas en `src/lib/reportes/consultas.ts`, reglas puras en `reglas.ts`. Exportar a Excel: catálogo en `src/lib/reportes/exportar.ts`, ruta `/exportar/[catalogo]`, generador propio sin dependencias en `src/lib/excel.ts`.
- Respaldos: `src/lib/respaldos.ts` (JSON por tabla + gzip; restaura con `json_populate_recordset` en orden de llaves foráneas, dentro de una transacción). El servidor guarda uno al día en `.data/respaldos` (`src/instrumentation.ts`; se apaga con `RESPALDOS_AUTOMATICOS=0` y en Vercel).
- PWA: `src/app/manifest.ts`, íconos en `src/app/icon.tsx`, `public/sw.js`. El worker solo guarda `/ventas/nueva` y `/_next/static`; las ventas sin conexión van a IndexedDB (`src/lib/offline/cola.ts`) con `claveLocal` para no duplicarse y las envía `VentasPendientes` en el encabezado. Si agregas una ruta pública (sin sesión), exclúyela también en el `matcher` de `src/proxy.ts`.
