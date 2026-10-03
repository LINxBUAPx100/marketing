@AGENTS.md

# Sistema de administración para imprenta

Plan completo y fases: `docs/PLAN.md` (versión visual: `docs/plan.html`). Todo el código, la UI y los mensajes están en español de México.

## Comandos

- `npm run dev` — servidor de desarrollo en http://localhost:3000
- `npm run db:generar` — genera una migración en `drizzle/` después de cambiar `src/db/schema.ts`
- `npm run db:migrar` — aplica migraciones
- `npm run db:demo` — carga datos de ejemplo (accesos en `scripts/datos-demo.mts`)
- `npm run db:reiniciar` — borra la base local y la recrea con datos de ejemplo
- `npm run typecheck`, `npx eslint src scripts`, `npm run build`

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
