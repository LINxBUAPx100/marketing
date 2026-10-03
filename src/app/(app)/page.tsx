import { count, eq } from "drizzle-orm";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, t } from "@/db";
import { requerirSesion } from "@/lib/auth";

// Avance del plan (docs/PLAN.md). Se actualiza al cerrar cada fase.
const FASES = [
  { n: 0, nombre: "Cimientos", detalle: "Acceso, roles, sucursales y bitácora", estado: "lista" },
  { n: 1, nombre: "Punto de venta", detalle: "Productos, clientes, ventas, anticipos y caja", estado: "siguiente" },
  { n: 2, nombre: "Producción y cotizaciones", detalle: "Órdenes, etapas y tablero en tiempo real", estado: "pendiente" },
  { n: 3, nombre: "Insumos y almacén", detalle: "Recetas, existencias, traspasos y proveedores", estado: "pendiente" },
  { n: 4, nombre: "Máquinas y contadores", detalle: "Lecturas, mermas y consumibles", estado: "pendiente" },
  { n: 5, nombre: "Comisiones y convenios", detalle: "Comisiones, precios especiales y por volumen", estado: "pendiente" },
  { n: 6, nombre: "Facturación CFDI 4.0", detalle: "Facturas, complementos y cancelaciones", estado: "pendiente" },
  { n: 7, nombre: "WhatsApp y reportes", detalle: "Envíos automáticos, panel y exportación", estado: "pendiente" },
] as const;

const ESTILO_ESTADO = {
  lista: { texto: "Lista", variante: "default" },
  siguiente: { texto: "Siguiente", variante: "secondary" },
  pendiente: { texto: "Pendiente", variante: "outline" },
} as const;

export default async function Inicio() {
  const sesion = await requerirSesion();
  const negocioId = sesion.negocio.id;
  const [[usuarios], [sucursales]] = await Promise.all([
    db.select({ n: count() }).from(t.usuario).where(eq(t.usuario.negocioId, negocioId)),
    db.select({ n: count() }).from(t.sucursal).where(eq(t.sucursal.negocioId, negocioId)),
  ]);
  const primerNombre = sesion.usuario.nombre.split(" ")[0];

  return (
    <>
      <Encabezado
        titulo={`Hola, ${primerNombre}`}
        descripcion={sesion.sucursal ? `Trabajando en ${sesion.sucursal.nombre}.` : "No tienes sucursal asignada."}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Dato etiqueta="Sucursales" valor={sucursales.n} href="/configuracion/sucursales" mostrar={sesion.puede("sucursales.ver")} />
        <Dato etiqueta="Usuarios" valor={usuarios.n} href="/configuracion/usuarios" mostrar={sesion.puede("usuarios.ver")} />
        <Dato etiqueta="Tu rol" valor={sesion.rol.nombre} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Avance del sistema</CardTitle>
          <CardDescription>Los módulos se activan en el menú conforme se termina cada fase.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-1">
            {FASES.map((f) => {
              const estilo = ESTILO_ESTADO[f.estado];
              return (
                <li key={f.n} className="flex items-center gap-3 rounded-md py-2">
                  <span className="text-muted-foreground w-7 font-mono text-xs">F{f.n}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{f.nombre}</p>
                    <p className="text-muted-foreground truncate text-sm">{f.detalle}</p>
                  </div>
                  <Badge variant={estilo.variante}>{estilo.texto}</Badge>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}

function Dato({ etiqueta, valor, href, mostrar = true }: { etiqueta: string; valor: string | number; href?: string; mostrar?: boolean }) {
  if (!mostrar) return null;
  const contenido = (
    <Card className="h-full transition-colors hover:[a>&]:bg-muted/40">
      <CardHeader>
        <CardDescription>{etiqueta}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{valor}</CardTitle>
      </CardHeader>
    </Card>
  );
  return href ? <Link href={href}>{contenido}</Link> : contenido;
}
