@AGENTS.md

# Sistema de administración para imprenta

Plan completo y fases: `docs/PLAN.md` (versión visual: `docs/plan.html`). Todo el código, la UI y los mensajes están en español de México.

## Comandos

- `npm run dev` — servidor de desarrollo en http://localhost:3000
- `npm run db:generar` — genera una migración en `drizzle/` después de cambiar `src/db/schema.ts`
- `npm run db:migrar` — aplica migraciones
- `npm run db:demo` — carga datos de ejemplo (accesos en `scripts/datos-demo.mts`)
- `npm run db:reiniciar` — borra la base local y la recrea con datos de ejemplo
- `npm test` (Vitest: lógica de dinero en `src/lib/**/*.test.ts`), `npm run typecheck`, `npx eslint src scripts`, `npm run build`

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
- Si `npm run dev` lo arrancó otra persona, no corras `db:*` encima: PGlite se daña con dos procesos.
- Imágenes: `src/lib/archivos.ts` guarda en `.data/archivos` (solo desarrollo). Para producción hay que cambiarlo a Supabase Storage.
