import { BarChart3, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresco } from "@/components/auto-refresco";
import { Buscador } from "@/components/buscador";
import { Encabezado } from "@/components/encabezado";
import { FiltroSelect } from "@/components/filtro-select";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requerirPermiso } from "@/lib/auth";
import { hoyEnMexico, inicioDelDia } from "@/lib/fechas";
import { ordenesDelTablero, usuariosActivos } from "@/lib/produccion/consultas";
import { urgencia } from "@/lib/produccion/reglas";
import { etapasDe } from "@/lib/produccion/servidor";
import { cn } from "@/lib/utils";
import { TarjetaOrden } from "./tarjeta-orden";

export const metadata: Metadata = { title: "Producción" };

export default async function PaginaProduccion({ searchParams }: PageProps<"/produccion">) {
  const sesion = await requerirPermiso("produccion.ver");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const misSucursales = sesion.sucursales.map((s) => s.id);
  const sucursal = sp.sucursal && misSucursales.includes(sp.sucursal) ? sp.sucursal : null;
  const soloMias = sp.ver === "mias";
  const q = sp.q?.trim().toLowerCase();

  const [etapas, usuarios, todas] = await Promise.all([
    etapasDe(sesion.negocio.id),
    usuariosActivos(sesion.negocio.id),
    ordenesDelTablero(sesion, {
      sucursalIds: sucursal ? [sucursal] : misSucursales,
      soloMias,
      entregadasDesde: inicioDelDia(hoyEnMexico()),
    }),
  ]);
  const ordenes = q ? todas.filter((o) => o.folio.toLowerCase().includes(q) || (o.cliente ?? "").toLowerCase().includes(q)) : todas;

  const activas = ordenes.filter((o) => o.estado === "activa");
  const conteo = {
    atrasadas: activas.filter((o) => urgencia(o.fechaCompromiso) === "atrasada").length,
    hoy: activas.filter((o) => urgencia(o.fechaCompromiso) === "hoy").length,
    listas: activas.filter((o) => etapas.find((e) => e.id === o.etapaId)?.tipo === "listo").length,
    entregadasHoy: ordenes.filter((o) => o.estado === "entregada").length,
  };
  const etapaOpciones = etapas.map((e) => ({ id: e.id, nombre: e.nombre, tipo: e.tipo, responsableId: e.responsableId }));
  const puedeMover = sesion.puede("produccion.editar");

  return (
    <>
      <AutoRefresco segundos={15} />
      <Encabezado titulo="Producción" descripcion="Se actualiza solo cada 15 segundos. El borde de color indica qué tan cerca está la entrega.">
        <Button variant="ghost" nativeButton={false} render={<Link href="/produccion/reporte" />}>
          <BarChart3 /> Tiempos
        </Button>
        {sesion.puede("produccion.etapas") && (
          <Button variant="outline" nativeButton={false} render={<Link href="/produccion/etapas" />}>
            <Settings2 /> Etapas
          </Button>
        )}
      </Encabezado>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Contador etiqueta="Atrasadas" valor={conteo.atrasadas} alerta={conteo.atrasadas > 0} />
        <Contador etiqueta="Vencen hoy" valor={conteo.hoy} />
        <Contador etiqueta="Listas para entregar" valor={conteo.listas} />
        <Contador etiqueta="Entregadas hoy" valor={conteo.entregadasHoy} />
      </div>

      <Buscador placeholder="Buscar por folio o cliente" valor={sp.q}>
        <FiltroSelect nombre="ver" valor={sp.ver} etiqueta="Qué órdenes ver">
          <option value="">Todas las órdenes</option>
          <option value="mias">Solo las mías</option>
        </FiltroSelect>
        {sesion.sucursales.length > 1 && (
          <FiltroSelect nombre="sucursal" valor={sucursal ?? ""} etiqueta="Sucursal">
            <option value="">Todas mis sucursales</option>
            {sesion.sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </FiltroSelect>
        )}
      </Buscador>

      {/* Tablero: una columna por etapa, con desplazamiento horizontal en pantallas chicas. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        <div className="grid auto-cols-[minmax(16rem,1fr)] grid-flow-col gap-3">
          {etapas.map((etapa) => {
            const enEtapa = ordenes.filter((o) => o.etapaId === etapa.id);
            return (
              <section key={etapa.id} className="bg-muted/50 grid content-start gap-2 rounded-xl p-2" aria-label={etapa.nombre}>
                <header className="flex items-center justify-between px-1 py-1">
                  <h2 className={cn("text-sm font-semibold", etapa.tipo === "listo" && "text-emerald-700")}>{etapa.nombre}</h2>
                  <span className="text-muted-foreground bg-background rounded-full px-2 text-xs tabular-nums">{enEtapa.length}</span>
                </header>
                {etapa.tipo === "entregado" && <p className="text-muted-foreground px-1 text-xs">Solo las entregadas hoy.</p>}
                {enEtapa.map((o) => (
                  <TarjetaOrden key={o.id} orden={o} etapas={etapaOpciones} usuarios={usuarios} puedeMover={puedeMover} mostrarSucursal={!sucursal && sesion.sucursales.length > 1} />
                ))}
                {enEtapa.length === 0 && <p className="text-muted-foreground px-1 py-6 text-center text-xs">Sin órdenes</p>}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Contador({ etiqueta, valor, alerta }: { etiqueta: string; valor: number; alerta?: boolean }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{etiqueta}</CardDescription>
        <CardTitle className={cn("text-2xl tabular-nums", alerta && "text-destructive")}>{valor}</CardTitle>
      </CardHeader>
    </Card>
  );
}
