import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import { formatoCantidad, formatoFecha, formatoMoneda } from "@/lib/numeros";
import { BarraImpresion } from "../../../barra-impresion";

export const metadata: Metadata = { title: "Cotización" };

export default async function ImprimirCotizacion({ params }: PageProps<"/imprimir/cotizacion/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("cotizaciones.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [fila] = await db
    .select({ cotizacion: t.cotizacion, cliente: t.cliente, sucursal: t.sucursal, vendedor: t.usuario.nombre })
    .from(t.cotizacion)
    .innerJoin(t.cliente, eq(t.cliente.id, t.cotizacion.clienteId))
    .innerJoin(t.sucursal, eq(t.sucursal.id, t.cotizacion.sucursalId))
    .innerJoin(t.usuario, eq(t.usuario.id, t.cotizacion.usuarioId))
    .where(and(eq(t.cotizacion.id, id), eq(t.cotizacion.negocioId, sesion.negocio.id)));
  if (!fila || !sesion.sucursales.some((s) => s.id === fila.cotizacion.sucursalId)) notFound();
  const partidas = await db.select().from(t.cotizacionPartida).where(eq(t.cotizacionPartida.cotizacionId, id)).orderBy(asc(t.cotizacionPartida.orden));

  const { cotizacion: c, cliente, sucursal } = fila;
  const negocio = sesion.negocio;

  return (
    <>
      <BarraImpresion />
      <article className="mx-auto max-w-[8.5in] p-10 text-sm print:max-w-none print:p-0">
        <style>{`@page { size: letter; margin: 1.5cm; }`}</style>
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
          <div>
            <h1 className="text-2xl font-bold">{negocio.nombre}</h1>
            {negocio.razonSocial && <p>{negocio.razonSocial}</p>}
            {negocio.rfc && <p>RFC {negocio.rfc}</p>}
            <p>{sucursal.direccion ?? negocio.direccion}</p>
            <p>{[sucursal.telefono ?? negocio.telefono, negocio.correo].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-wider uppercase">Cotización</p>
            <p className="font-mono text-2xl font-bold">{c.folio}</p>
            <p>{formatoFecha(c.creadoEn)}</p>
            <p className="font-semibold">Válida hasta {formatoFecha(c.vigenciaHasta)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-4">
          <div>
            <p className="text-xs tracking-wider text-neutral-600 uppercase">Para</p>
            <p className="font-semibold">{cliente.nombre}</p>
            {cliente.empresa && <p>{cliente.empresa}</p>}
            {cliente.telefono && <p>{cliente.telefono}</p>}
            {cliente.correo && <p>{cliente.correo}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs tracking-wider text-neutral-600 uppercase">Atiende</p>
            <p className="font-semibold">{fila.vendedor}</p>
          </div>
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-black text-left text-xs uppercase">
              <th className="py-2 pr-2">Cant.</th>
              <th className="py-2 pr-2">Concepto</th>
              <th className="py-2 pr-2 text-right">P. unitario</th>
              <th className="py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {partidas.map((p) => (
              <tr key={p.id} className="border-b border-neutral-300 align-top">
                <td className="py-2 pr-2 whitespace-nowrap tabular-nums">
                  {formatoCantidad(p.cantidad)} {p.unidad}
                </td>
                <td className="py-2 pr-2">
                  {p.descripcion}
                  {p.notas && <span className="block text-xs whitespace-pre-line text-neutral-600">{p.notas}</span>}
                  {p.descuento > 0 && <span className="block text-xs">Descuento −{formatoMoneda(p.descuento)}</span>}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatoMoneda(p.precioUnitario)}</td>
                <td className="py-2 text-right tabular-nums">{formatoMoneda(p.importe)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex justify-between gap-8">
          <div className="max-w-[60%] text-xs">{c.notas && <p className="whitespace-pre-line">{c.notas}</p>}</div>
          <dl className="grid w-64 shrink-0 gap-1 tabular-nums">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatoMoneda(c.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>IVA {negocio.ivaBp / 100}%</dt>
              <dd>{formatoMoneda(c.iva)}</dd>
            </div>
            <div className="flex justify-between border-t border-black pt-1 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatoMoneda(c.total)}</dd>
            </div>
          </dl>
        </section>

        {c.condiciones && (
          <section className="mt-8 border-t border-neutral-300 pt-3 text-xs text-neutral-700">
            <p className="mb-1 font-semibold tracking-wider uppercase">Condiciones</p>
            <p className="whitespace-pre-line">{c.condiciones}</p>
          </section>
        )}
      </article>
    </>
  );
}
