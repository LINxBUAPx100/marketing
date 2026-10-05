import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ArrowLeft, Receipt, Shuffle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresco } from "@/components/auto-refresco";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoCantidad, formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { usuariosActivos } from "@/lib/produccion/consultas";
import { ETIQUETA_URGENCIA, formatoDuracion, urgencia } from "@/lib/produccion/reglas";
import { etapasDe } from "@/lib/produccion/servidor";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { whatsappConfigurado } from "@/lib/mensajes/proveedor";
import { BotonWhatsApp } from "@/components/boton-whatsapp";
import { DialogoMover } from "../dialogo-mover";

export const metadata: Metadata = { title: "Orden de producción" };

export default async function PaginaOrden({ params }: PageProps<"/produccion/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("produccion.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const responsable = alias(t.usuario, "responsable");

  const [fila] = await db
    .select({ orden: t.ordenProduccion, venta: t.venta, cliente: t.cliente, sucursal: t.sucursal.nombre, etapa: t.etapaProduccion, responsable: responsable.nombre })
    .from(t.ordenProduccion)
    .innerJoin(t.venta, eq(t.venta.id, t.ordenProduccion.ventaId))
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.ordenProduccion.sucursalId))
    .innerJoin(t.etapaProduccion, eq(t.etapaProduccion.id, t.ordenProduccion.etapaId))
    .leftJoin(t.cliente, eq(t.cliente.id, t.venta.clienteId))
    .leftJoin(responsable, eq(responsable.id, t.ordenProduccion.responsableId))
    .where(and(eq(t.ordenProduccion.id, id), eq(t.ordenProduccion.negocioId, sesion.negocio.id)));
  if (!fila || !sesion.sucursales.some((s) => s.id === fila.orden.sucursalId)) notFound();

  const quien = alias(t.usuario, "quien");
  const [partidas, eventos, etapas, usuarios] = await Promise.all([
    db.select().from(t.ventaPartida).where(eq(t.ventaPartida.ventaId, fila.venta.id)).orderBy(asc(t.ventaPartida.orden)),
    db
      .select({ id: t.ordenEvento.id, creadoEn: t.ordenEvento.creadoEn, nota: t.ordenEvento.nota, etapaId: t.ordenEvento.etapaId, etapa: t.etapaProduccion.nombre, usuario: quien.nombre, responsable: responsable.nombre })
      .from(t.ordenEvento)
      .innerJoin(t.etapaProduccion, eq(t.etapaProduccion.id, t.ordenEvento.etapaId))
      .innerJoin(quien, eq(quien.id, t.ordenEvento.usuarioId))
      .leftJoin(responsable, eq(responsable.id, t.ordenEvento.responsableId))
      .where(eq(t.ordenEvento.ordenId, id))
      .orderBy(asc(t.ordenEvento.creadoEn)),
    etapasDe(sesion.negocio.id),
    usuariosActivos(sesion.negocio.id),
  ]);

  const { orden, venta, cliente, etapa } = fila;
  const saldo = venta.estado === "activa" ? venta.total - venta.pagado : 0;
  const u = orden.estado === "activa" ? urgencia(orden.fechaCompromiso) : null;
  const ahora = new Date();
  const mensajeListo = [
    `Hola ${cliente?.nombre.split(" ")[0] ?? ""}, tu pedido ${venta.folio} ya está listo en ${sesion.negocio.nombre} (${fila.sucursal}).`,
    saldo > 0 ? `Saldo pendiente: ${formatoMoneda(saldo)}.` : "",
    "¡Te esperamos!",
  ]
    .filter(Boolean)
    .join("\n");
  const whatsapp = enlaceWhatsApp(cliente?.telefono, mensajeListo);
  const ESTADO = { activa: null, entregada: "Entregada", cancelada: "Cancelada" } as const;

  return (
    <>
      <AutoRefresco segundos={20} />
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/produccion" />}>
        <ArrowLeft /> Producción
      </Button>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{venta.folio}</h1>
            <Badge>{etapa.nombre}</Badge>
            {u && u !== "a-tiempo" && <Badge variant={u === "atrasada" ? "destructive" : "outline"}>{ETIQUETA_URGENCIA[u]}</Badge>}
            {ESTADO[orden.estado] && <Badge variant="outline">{ESTADO[orden.estado]}</Badge>}
          </div>
          <p className="text-muted-foreground text-sm">
            {cliente?.nombre ?? "Público en general"} · {fila.sucursal} · Responsable: {fila.responsable ?? "nadie"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href={`/ventas/${venta.id}`} />}>
            <Receipt /> Venta
          </Button>
          {cliente && etapa.tipo !== "proceso" && (
            <BotonWhatsApp
              api={whatsappConfigurado()}
              clave="pedido_listo"
              entidadId={venta.id}
              enlace={whatsapp}
              etiqueta="Avisar que está listo"
              variant={etapa.tipo === "listo" ? "default" : "outline"}
            />
          )}
          {sesion.puede("produccion.editar") && orden.estado === "activa" && (
            <DialogoMover
              orden={{ id: orden.id, folio: venta.folio, etapaId: orden.etapaId, responsableId: orden.responsableId, saldo }}
              etapas={etapas.map((e) => ({ id: e.id, nombre: e.nombre, tipo: e.tipo, responsableId: e.responsableId }))}
              usuarios={usuarios}
              disparador={
                <Button>
                  <Shuffle /> Mover o asignar
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Qué hay que hacer</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {partidas.map((p) => (
                  <li key={p.id} className="grid gap-0.5 py-2.5 first:pt-0 last:pb-0">
                    <p className="font-medium">
                      <span className="tabular-nums">{formatoCantidad(p.cantidad)}</span> {p.unidad} · {p.descripcion}
                    </p>
                    {p.notas && <p className="text-muted-foreground text-sm whitespace-pre-line">{p.notas}</p>}
                  </li>
                ))}
              </ul>
              {venta.notas && <p className="text-muted-foreground mt-3 border-t pt-3 text-sm whitespace-pre-line">{venta.notas}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative grid gap-4 border-l pl-5">
                {eventos.map((e, i) => {
                  const fin = eventos[i + 1]?.creadoEn ?? (orden.estado === "activa" ? ahora : e.creadoEn);
                  const horas = (fin.getTime() - e.creadoEn.getTime()) / 3_600_000;
                  return (
                    <li key={e.id} className="relative grid gap-0.5 text-sm">
                      <span className="bg-primary absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full" aria-hidden />
                      <p>
                        <span className="font-medium">{e.etapa}</span>
                        {e.responsable && <span className="text-muted-foreground"> · a cargo de {e.responsable}</span>}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatoFechaHora(e.creadoEn)} · {e.usuario}
                        {(i < eventos.length - 1 || orden.estado === "activa") && ` · ${i === eventos.length - 1 ? "lleva" : "duró"} ${formatoDuracion(horas)}`}
                      </p>
                      {e.nota && <p className="text-muted-foreground text-xs italic">{e.nota}</p>}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <Card className="content-start">
          <CardHeader>
            <CardTitle>Entrega</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Linea etiqueta="Compromiso" valor={orden.fechaCompromiso ? formatoFechaHora(orden.fechaCompromiso) : "Sin fecha"} />
            {orden.entregadaEn && <Linea etiqueta="Entregada" valor={formatoFechaHora(orden.entregadaEn)} />}
            <Linea etiqueta="Total" valor={formatoMoneda(venta.total)} />
            <Linea etiqueta="Saldo" valor={formatoMoneda(saldo)} alerta={saldo > 0} />
            {cliente?.telefono && <Linea etiqueta="Teléfono" valor={cliente.telefono} />}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Linea({ etiqueta, valor, alerta }: { etiqueta: string; valor: string; alerta?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className={`text-right tabular-nums ${alerta ? "text-destructive font-semibold" : ""}`}>{valor}</span>
    </div>
  );
}
