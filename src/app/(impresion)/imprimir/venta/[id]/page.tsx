import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirPermiso } from "@/lib/auth";
import { ETIQUETA_METODO } from "@/lib/caja/resumen";
import { formatoCantidad, formatoFechaHora, formatoMoneda } from "@/lib/numeros";
import { obtenerVenta, type VentaCompleta } from "@/lib/ventas/consultas";
import { BarraImpresion } from "../../../barra-impresion";

export const metadata: Metadata = { title: "Nota de venta" };

export default async function ImprimirVenta({ params, searchParams }: PageProps<"/imprimir/venta/[id]">) {
  const { id } = await params;
  const { formato } = (await searchParams) as Record<string, string | undefined>;
  const sesion = await requerirPermiso("ventas.ver");
  const datos = await obtenerVenta(sesion, id);
  if (!datos) notFound();

  const negocio = sesion.negocio;
  return (
    <>
      <BarraImpresion />
      {formato === "ticket" ? <Ticket datos={datos} negocio={negocio} /> : <Nota datos={datos} negocio={negocio} />}
    </>
  );
}

type Negocio = { nombre: string; razonSocial: string | null; rfc: string | null; direccion: string | null; telefono: string | null; correo: string | null; ivaBp: number };

function Nota({ datos, negocio }: { datos: VentaCompleta; negocio: Negocio }) {
  const { venta, cliente, sucursal, partidas, pagos, saldo } = datos;
  const vigentes = pagos.filter((p) => !p.cancelado);
  return (
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
          <p className="text-xs tracking-wider uppercase">Nota de venta</p>
          <p className="font-mono text-2xl font-bold">{venta.folio}</p>
          <p>{formatoFechaHora(venta.creadoEn)}</p>
          <p>{sucursal.nombre}</p>
          {venta.estado === "cancelada" && <p className="mt-1 font-bold">CANCELADA</p>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 py-4">
        <div>
          <p className="text-xs tracking-wider text-neutral-600 uppercase">Cliente</p>
          <p className="font-semibold">{cliente?.nombre ?? "Público en general"}</p>
          {cliente?.empresa && <p>{cliente.empresa}</p>}
          {cliente?.telefono && <p>{cliente.telefono}</p>}
          {cliente?.rfc && <p>RFC {cliente.rfc}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs tracking-wider text-neutral-600 uppercase">Entrega</p>
          <p className="font-semibold">{venta.fechaEntrega ? formatoFechaHora(venta.fechaEntrega) : "Por definir"}</p>
          <p>Atendió: {datos.vendedor}</p>
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
        <div className="max-w-[60%] text-xs">
          {vigentes.length > 0 && (
            <>
              <p className="mb-1 tracking-wider text-neutral-600 uppercase">Pagos</p>
              {vigentes.map((p) => (
                <p key={p.id}>
                  {formatoFechaHora(p.creadoEn)} · {ETIQUETA_METODO[p.metodo]} · {formatoMoneda(p.monto)}
                </p>
              ))}
            </>
          )}
          {venta.notas && <p className="mt-3 whitespace-pre-line">{venta.notas}</p>}
        </div>
        <dl className="grid w-64 shrink-0 gap-1 tabular-nums">
          <Renglon etiqueta="Subtotal" valor={venta.subtotal} />
          <Renglon etiqueta={`IVA ${negocio.ivaBp / 100}%`} valor={venta.iva} />
          <Renglon etiqueta="Total" valor={venta.total} fuerte />
          <Renglon etiqueta="Pagado" valor={venta.pagado} />
          <Renglon etiqueta="Saldo" valor={saldo} fuerte />
        </dl>
      </section>

      <footer className="mt-10 border-t border-neutral-300 pt-3 text-center text-xs text-neutral-600">
        Este documento no es un comprobante fiscal. Gracias por su preferencia.
      </footer>
    </article>
  );
}

function Renglon({ etiqueta, valor, fuerte }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between ${fuerte ? "border-t border-black pt-1 text-base font-bold" : ""}`}>
      <dt>{etiqueta}</dt>
      <dd>{formatoMoneda(valor)}</dd>
    </div>
  );
}

/** Ticket para impresora térmica de 80 mm (72 mm imprimibles). */
function Ticket({ datos, negocio }: { datos: VentaCompleta; negocio: Negocio }) {
  const { venta, cliente, sucursal, partidas, pagos, saldo } = datos;
  const vigentes = pagos.filter((p) => !p.cancelado);
  const cambio = vigentes.reduce((s, p) => s + (p.recibido != null ? p.recibido - p.monto : 0), 0);
  return (
    <article className="mx-auto w-[72mm] py-4 font-mono text-[11px] leading-tight print:py-0">
      <style>{`@page { size: 80mm auto; margin: 4mm; }`}</style>
      <header className="text-center">
        <p className="text-sm font-bold">{negocio.nombre}</p>
        {negocio.rfc && <p>RFC {negocio.rfc}</p>}
        <p>{sucursal.direccion ?? negocio.direccion}</p>
        <p>{sucursal.telefono ?? negocio.telefono}</p>
      </header>
      <Separador />
      <p>
        Folio: <b>{venta.folio}</b>
      </p>
      <p>{formatoFechaHora(venta.creadoEn)}</p>
      <p>Cliente: {cliente?.nombre ?? "Público en general"}</p>
      <p>Atendió: {datos.vendedor}</p>
      {venta.estado === "cancelada" && <p className="text-center font-bold">*** CANCELADA ***</p>}
      <Separador />
      {partidas.map((p) => (
        <div key={p.id} className="mb-1">
          <p>{p.descripcion}</p>
          <p className="flex justify-between">
            <span>
              {formatoCantidad(p.cantidad)} x {formatoMoneda(p.precioUnitario)}
            </span>
            <span>{formatoMoneda(p.importe)}</span>
          </p>
        </div>
      ))}
      <Separador />
      <Par etiqueta="Subtotal" valor={venta.subtotal} />
      <Par etiqueta={`IVA ${negocio.ivaBp / 100}%`} valor={venta.iva} />
      <Par etiqueta="TOTAL" valor={venta.total} fuerte />
      {vigentes.map((p) => (
        <Par key={p.id} etiqueta={ETIQUETA_METODO[p.metodo]} valor={p.recibido ?? p.monto} />
      ))}
      {cambio > 0 && <Par etiqueta="Cambio" valor={cambio} />}
      {saldo > 0 && <Par etiqueta="SALDO" valor={saldo} fuerte />}
      {venta.fechaEntrega && (
        <>
          <Separador />
          <p>Entrega: {formatoFechaHora(venta.fechaEntrega)}</p>
        </>
      )}
      <Separador />
      <p className="text-center">Gracias por su compra</p>
      <p className="text-center">No es comprobante fiscal</p>
    </article>
  );
}

const Separador = () => <p className="my-1 overflow-hidden whitespace-nowrap">{"-".repeat(48)}</p>;

function Par({ etiqueta, valor, fuerte }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <p className={`flex justify-between ${fuerte ? "text-[13px] font-bold" : ""}`}>
      <span>{etiqueta}</span>
      <span>{formatoMoneda(valor)}</span>
    </p>
  );
}
