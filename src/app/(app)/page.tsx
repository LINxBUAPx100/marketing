import { and, asc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { TablaVentas } from "@/components/tabla-ventas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, t } from "@/db";
import { requerirSesion } from "@/lib/auth";
import { hoyEnMexico, rangoDeDias } from "@/lib/fechas";
import { formatoMoneda } from "@/lib/numeros";

// Avance del plan (docs/PLAN.md). Se actualiza al cerrar cada fase.
const FASES = [
  { n: 0, nombre: "Cimientos", detalle: "Acceso, roles, sucursales y bitácora", estado: "lista" },
  { n: 1, nombre: "Punto de venta", detalle: "Productos, clientes, ventas, anticipos y caja", estado: "lista" },
  { n: 2, nombre: "Producción y cotizaciones", detalle: "Órdenes, etapas y tablero en tiempo real", estado: "siguiente" },
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
  const sucursalId = sesion.sucursal?.id;
  const hoy = rangoDeDias(hoyEnMexico(), hoyEnMexico());
  const primerNombre = sesion.usuario.nombre.split(" ")[0];
  const verVentas = sesion.puede("ventas.ver") && !!sucursalId;
  const misSucursales = sesion.sucursales.map((s) => s.id);

  const [ventasHoy, cobradoHoy, porCobrar, entregas] = verVentas
    ? await Promise.all([
        db
          .select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${t.venta.total}), 0)::int` })
          .from(t.venta)
          .where(and(eq(t.venta.sucursalId, sucursalId!), eq(t.venta.estado, "activa"), gte(t.venta.creadoEn, hoy.inicio), lt(t.venta.creadoEn, hoy.fin))),
        db
          .select({ total: sql<number>`coalesce(sum(${t.pago.monto}), 0)::int` })
          .from(t.pago)
          .where(and(eq(t.pago.sucursalId, sucursalId!), eq(t.pago.cancelado, false), gte(t.pago.creadoEn, hoy.inicio), lt(t.pago.creadoEn, hoy.fin))),
        db
          .select({ total: sql<number>`coalesce(sum(${t.venta.total} - ${t.venta.pagado}), 0)::int` })
          .from(t.venta)
          .where(and(eq(t.venta.negocioId, negocioId), inArray(t.venta.sucursalId, misSucursales), eq(t.venta.estado, "activa"))),
        // Próximas entregas: lo que vence de hoy en adelante y lo atrasado.
        db
          .select({
            id: t.venta.id,
            folio: t.venta.folio,
            creadoEn: t.venta.creadoEn,
            fechaEntrega: t.venta.fechaEntrega,
            total: t.venta.total,
            pagado: t.venta.pagado,
            estado: t.venta.estado,
            cliente: t.cliente.nombre,
          })
          .from(t.venta)
          .leftJoin(t.cliente, eq(t.cliente.id, t.venta.clienteId))
          .where(
            and(
              eq(t.venta.sucursalId, sucursalId!),
              eq(t.venta.estado, "activa"),
              isNotNull(t.venta.fechaEntrega),
              lt(t.venta.fechaEntrega, new Date(hoy.fin.getTime() + 2 * 86_400_000)),
              gte(t.venta.fechaEntrega, new Date(hoy.inicio.getTime() - 7 * 86_400_000)),
            ),
          )
          .orderBy(asc(t.venta.fechaEntrega))
          .limit(10),
      ])
    : [[{ n: 0, total: 0 }], [{ total: 0 }], [{ total: 0 }], []];

  return (
    <>
      <Encabezado titulo={`Hola, ${primerNombre}`} descripcion={sesion.sucursal ? `Trabajando en ${sesion.sucursal.nombre}.` : "No tienes sucursal asignada."}>
        {sesion.puede("ventas.crear") && sucursalId && (
          <Button size="lg" nativeButton={false} render={<Link href="/ventas/nueva" />}>
            <Plus /> Nueva venta
          </Button>
        )}
      </Encabezado>

      {verVentas && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Dato etiqueta="Vendido hoy" valor={formatoMoneda(ventasHoy[0].total)} detalle={`${ventasHoy[0].n} ventas`} href="/ventas" />
            <Dato etiqueta="Cobrado hoy" valor={formatoMoneda(cobradoHoy[0].total)} href={sesion.puede("caja.ver") ? "/caja" : undefined} />
            <Dato
              etiqueta="Por cobrar"
              valor={formatoMoneda(porCobrar[0].total)}
              href={sesion.puede("cxc.ver") ? "/cuentas-por-cobrar" : undefined}
              alerta={porCobrar[0].total > 0}
            />
          </div>
          <Card className="mt-6 py-0">
            <CardHeader className="pt-4">
              <CardTitle>Entregas próximas</CardTitle>
              <CardDescription>Atrasadas y las que vencen hoy, mañana o pasado.</CardDescription>
            </CardHeader>
            <TablaVentas ventas={entregas} mostrarEntrega vacio="No hay entregas próximas con fecha." />
          </Card>
        </>
      )}

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

function Dato({ etiqueta, valor, detalle, href, alerta }: { etiqueta: string; valor: string; detalle?: string; href?: string; alerta?: boolean }) {
  const contenido = (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>{etiqueta}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${alerta ? "text-destructive" : ""}`}>{valor}</CardTitle>
        {detalle && <CardDescription>{detalle}</CardDescription>}
      </CardHeader>
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-xl outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50">
      {contenido}
    </Link>
  ) : (
    contenido
  );
}
