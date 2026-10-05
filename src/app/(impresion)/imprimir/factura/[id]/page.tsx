import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, t } from "@/db";
import { requerirPermiso } from "@/lib/auth";
import type { ConceptoCfdi, DocumentoPagado, ReceptorCfdi } from "@/lib/facturacion/pac";
import { ETIQUETA_FORMA_PAGO } from "@/lib/facturacion/reglas";
import { formatoCantidad, formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { REGIMENES_FISCALES, USOS_CFDI } from "@/lib/sat";
import { BarraImpresion } from "../../../barra-impresion";

export const metadata: Metadata = { title: "Factura" };

const nombreRegimen = (c: string | null) => REGIMENES_FISCALES.find(([k]) => k === c)?.[1] ?? "";
const nombreUso = (c: string) => USOS_CFDI.find(([k]) => k === c)?.[1] ?? "";

export default async function ImprimirFactura({ params }: PageProps<"/imprimir/factura/[id]">) {
  const { id } = await params;
  const sesion = await requerirPermiso("facturacion.ver");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [f] = await db
    .select()
    .from(t.factura)
    .where(and(eq(t.factura.id, id), eq(t.factura.negocioId, sesion.negocio.id)));
  if (!f || !sesion.sucursales.some((s) => s.id === f.sucursalId)) notFound();
  const n = sesion.negocio;
  const r = f.receptor as ReceptorCfdi;

  return (
    <>
      <BarraImpresion />
      <article className="relative mx-auto max-w-[8.5in] p-10 text-xs print:max-w-none print:p-0">
        <style>{`@page { size: letter; margin: 1.2cm; }`}</style>
        {f.simulada && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-center text-5xl font-black tracking-widest text-red-600/15 uppercase select-none" aria-hidden>
            Sin validez fiscal
          </p>
        )}
        {f.estado === "cancelada" && <p className="mb-3 border-2 border-red-600 py-1 text-center text-base font-bold text-red-600">CANCELADA</p>}
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
          <div>
            <h1 className="text-lg font-bold">{n.razonSocial ?? n.nombre}</h1>
            <p>RFC {n.rfc}</p>
            <p>
              Régimen {n.regimenFiscal} {nombreRegimen(n.regimenFiscal)}
            </p>
            <p>Lugar de expedición (C.P.) {n.codigoPostal}</p>
          </div>
          <div className="text-right">
            <p className="tracking-wider uppercase">{f.tipo === "P" ? "Recepción de pagos" : "Factura"}</p>
            <p className="font-mono text-xl font-bold">
              {f.serie}-{f.folio}
            </p>
            <p>{formatoFechaHora(f.creadoEn)}</p>
            <p>CFDI 4.0 · Tipo {f.tipo === "P" ? "P (Pago)" : "I (Ingreso)"}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-3">
          <div>
            <p className="font-semibold uppercase">Receptor</p>
            <p className="font-semibold">{r.nombre}</p>
            <p>RFC {r.rfc}</p>
            <p>
              Régimen {r.regimen} {nombreRegimen(r.regimen)}
            </p>
            <p>C.P. {r.codigoPostal}</p>
            <p>
              Uso {r.uso} {nombreUso(r.uso)}
            </p>
          </div>
          {f.tipo === "I" && (
            <div className="text-right">
              <p>Método de pago: {f.metodoPago === "PUE" ? "PUE Pago en una sola exhibición" : "PPD Pago en parcialidades o diferido"}</p>
              <p>Forma de pago: {ETIQUETA_FORMA_PAGO[f.formaPago ?? ""] ?? f.formaPago}</p>
              <p>Moneda: MXN</p>
              {f.global != null && <p>Información global: {JSON.stringify(f.global).replace(/[{}"]/g, " ")}</p>}
            </div>
          )}
        </section>

        {f.tipo === "I" ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-black text-left uppercase">
                <th className="py-1.5 pr-2">Clave</th>
                <th className="py-1.5 pr-2">Cant.</th>
                <th className="py-1.5 pr-2">Unidad</th>
                <th className="py-1.5 pr-2">Descripción</th>
                <th className="py-1.5 pr-2 text-right">P. unitario</th>
                <th className="py-1.5 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {(f.conceptos as ConceptoCfdi[]).map((c, i) => (
                <tr key={i} className="border-b border-neutral-300 align-top">
                  <td className="py-1.5 pr-2 font-mono">{c.claveProdServ}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{formatoCantidad(c.cantidad)}</td>
                  <td className="py-1.5 pr-2">
                    {c.claveUnidad} {c.unidad}
                  </td>
                  <td className="py-1.5 pr-2">
                    {c.descripcion}
                    {c.descuento > 0 && <span className="block">Descuento {formatoMoneda(c.descuento)}</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatoMoneda(c.precioUnitario)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatoMoneda(Math.round(c.cantidad * c.precioUnitario) - c.descuento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-black text-left uppercase">
                <th className="py-1.5 pr-2">Documento relacionado</th>
                <th className="py-1.5 pr-2 text-right">Parcialidad</th>
                <th className="py-1.5 pr-2 text-right">Saldo anterior</th>
                <th className="py-1.5 text-right">Pagado</th>
              </tr>
            </thead>
            <tbody>
              {(f.conceptos as DocumentoPagado[]).map((d) => (
                <tr key={d.uuid} className="border-b border-neutral-300">
                  <td className="py-1.5 pr-2 font-mono">{d.uuid}</td>
                  <td className="py-1.5 pr-2 text-right">{d.parcialidad}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatoMoneda(d.saldoAnterior)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatoMoneda(d.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {f.tipo === "I" && (
          <dl className="mt-3 ml-auto grid w-64 gap-1 tabular-nums">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatoMoneda(f.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>IVA {n.ivaBp / 100}%</dt>
              <dd>{formatoMoneda(f.iva)}</dd>
            </div>
            <div className="flex justify-between border-t border-black pt-1 text-sm font-bold">
              <dt>Total</dt>
              <dd>{formatoMoneda(f.total)}</dd>
            </div>
          </dl>
        )}

        <footer className="mt-6 grid gap-1 border-t border-neutral-400 pt-3 font-mono text-[10px] break-all">
          <p>Folio fiscal (UUID): {f.uuid}</p>
          <p>{f.simulada ? "SIMULACIÓN — este comprobante no fue certificado por un PAC ni reportado al SAT." : "Este documento es una representación impresa de un CFDI."}</p>
        </footer>
      </article>
    </>
  );
}
