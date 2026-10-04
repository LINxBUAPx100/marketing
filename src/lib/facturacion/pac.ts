import "server-only";
import { randomUUID } from "node:crypto";

// Proveedor de timbrado (PAC). Con FACTURAPI_KEY se timbra de verdad con Facturapi
// (llave sk_test_… = ambiente de pruebas del SAT; sk_live_… = facturas reales).
// Sin llave se usa el simulador: genera comprobantes SIN VALIDEZ FISCAL para probar el flujo.

export type ReceptorCfdi = { rfc: string; nombre: string; regimen: string; codigoPostal: string; uso: string; correo?: string | null };

export type ConceptoCfdi = {
  descripcion: string;
  claveProdServ: string;
  claveUnidad: string;
  unidad: string;
  cantidad: number;
  /** Centavos por unidad, con IVA incluido si `ivaIncluido`. */
  precioUnitario: number;
  /** Centavos de descuento de la partida completa. */
  descuento: number;
  noIdentificacion?: string;
};

export type SolicitudIngreso = {
  tipo: "I";
  serie: string;
  folio: number;
  receptor: ReceptorCfdi;
  conceptos: ConceptoCfdi[];
  formaPago: string;
  metodoPago: "PUE" | "PPD";
  ivaBp: number;
  ivaIncluido: boolean;
  global?: { periodicidad: "day" | "week" | "fortnight" | "month" | "two_months"; meses: string; anio: number };
};

export type DocumentoPagado = { uuid: string; monto: number; parcialidad: number; saldoAnterior: number; base: number };

export type SolicitudPago = {
  tipo: "P";
  serie: string;
  folio: number;
  receptor: ReceptorCfdi;
  formaPago: string;
  fecha: Date;
  documentos: DocumentoPagado[];
  ivaBp: number;
};

export type Timbrado = { pacId: string; uuid: string; xml: string | null; simulada: boolean };

export interface Pac {
  nombre: string;
  simulado: boolean;
  timbrar(s: SolicitudIngreso | SolicitudPago): Promise<Timbrado>;
  cancelar(pacId: string, motivo: string, sustitucion?: string | null): Promise<void>;
  pdf(pacId: string): Promise<ArrayBuffer | null>;
}

export class ErrorPac extends Error {}

const pesos = (centavos: number) => Math.round(centavos) / 100;

// ─── Facturapi ──────────────────────────────────────────────────────────────

class Facturapi implements Pac {
  nombre = "Facturapi";
  simulado = false;
  constructor(private llave: string) {}

  private async pedir(ruta: string, init: RequestInit = {}) {
    const r = await fetch(`https://www.facturapi.io/v2${ruta}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.llave}`, "Content-Type": "application/json", ...init.headers },
    });
    if (!r.ok) {
      const cuerpo = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new ErrorPac(cuerpo?.message ?? `El PAC respondió ${r.status}.`);
    }
    return r;
  }

  private cliente(r: ReceptorCfdi) {
    return { legal_name: r.nombre, tax_id: r.rfc, tax_system: r.regimen, email: r.correo || undefined, address: { zip: r.codigoPostal } };
  }

  async timbrar(s: SolicitudIngreso | SolicitudPago): Promise<Timbrado> {
    const tasa = s.ivaBp / 10000;
    const cuerpo =
      s.tipo === "I"
        ? {
            type: "I",
            customer: this.cliente(s.receptor),
            items: s.conceptos.map((c) => ({
              quantity: c.cantidad,
              discount: pesos(c.descuento),
              product: {
                description: c.descripcion,
                product_key: c.claveProdServ,
                unit_key: c.claveUnidad,
                unit_name: c.unidad,
                sku: c.noIdentificacion,
                price: pesos(c.precioUnitario),
                tax_included: s.ivaIncluido,
                taxes: [{ type: "IVA", rate: tasa }],
              },
            })),
            payment_form: s.formaPago,
            payment_method: s.metodoPago,
            use: s.receptor.uso,
            series: s.serie,
            folio_number: s.folio,
            global: s.global ? { periodicity: s.global.periodicidad, months: s.global.meses, year: s.global.anio } : undefined,
          }
        : {
            type: "P",
            customer: this.cliente(s.receptor),
            series: s.serie,
            folio_number: s.folio,
            complements: [
              {
                type: "pago",
                data: [
                  {
                    payment_form: s.formaPago,
                    date: s.fecha.toISOString(),
                    related_documents: s.documentos.map((d) => ({
                      uuid: d.uuid,
                      amount: pesos(d.monto),
                      installment: d.parcialidad,
                      last_balance: pesos(d.saldoAnterior),
                      taxes: [{ base: pesos(d.base), type: "IVA", rate: tasa }],
                    })),
                  },
                ],
              },
            ],
          };
    const r = await this.pedir("/invoices", { method: "POST", body: JSON.stringify(cuerpo) });
    const factura = (await r.json()) as { id: string; uuid: string };
    const xml = await this.pedir(`/invoices/${factura.id}/xml`)
      .then((x) => x.text())
      .catch(() => null);
    return { pacId: factura.id, uuid: factura.uuid, xml, simulada: false };
  }

  async cancelar(pacId: string, motivo: string, sustitucion?: string | null) {
    const q = new URLSearchParams({ motive: motivo, ...(sustitucion ? { substitution: sustitucion } : {}) });
    await this.pedir(`/invoices/${pacId}?${q}`, { method: "DELETE" });
  }

  async pdf(pacId: string) {
    const r = await this.pedir(`/invoices/${pacId}/pdf`);
    return r.arrayBuffer();
  }
}

// ─── Simulador ──────────────────────────────────────────────────────────────

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

class Simulador implements Pac {
  nombre = "Simulador (sin validez fiscal)";
  simulado = true;

  async timbrar(s: SolicitudIngreso | SolicitudPago): Promise<Timbrado> {
    const uuid = randomUUID().toUpperCase();
    // El CFDI lleva la hora local del lugar de expedición (centro de México), sin zona.
    const ahora = new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 19);
    const cuerpo =
      s.tipo === "I"
        ? s.conceptos
            .map(
              (c) =>
                `    <cfdi:Concepto ClaveProdServ="${c.claveProdServ}" ClaveUnidad="${c.claveUnidad}" Unidad="${escapar(c.unidad)}" Cantidad="${c.cantidad}" Descripcion="${escapar(c.descripcion)}" ValorUnitario="${pesos(c.precioUnitario)}" Descuento="${pesos(c.descuento)}"/>`,
            )
            .join("\n")
        : s.documentos.map((d) => `    <pago20:DoctoRelacionado IdDocumento="${d.uuid}" NumParcialidad="${d.parcialidad}" ImpSaldoAnt="${pesos(d.saldoAnterior)}" ImpPagado="${pesos(d.monto)}"/>`).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- SIMULACIÓN: este comprobante NO fue timbrado por un PAC y NO tiene validez fiscal. -->
<cfdi:Comprobante Version="4.0" TipoDeComprobante="${s.tipo}" Serie="${escapar(s.serie)}" Folio="${s.folio}" Fecha="${ahora}"${s.tipo === "I" ? ` FormaPago="${s.formaPago}" MetodoPago="${s.metodoPago}"` : ""}>
  <cfdi:Receptor Rfc="${s.receptor.rfc}" Nombre="${escapar(s.receptor.nombre)}" RegimenFiscalReceptor="${s.receptor.regimen}" DomicilioFiscalReceptor="${s.receptor.codigoPostal}" UsoCFDI="${s.receptor.uso}"/>
  <cfdi:Conceptos>
${cuerpo}
  </cfdi:Conceptos>
  <cfdi:Complemento><tfd:TimbreFiscalDigital UUID="${uuid}" FechaTimbrado="${ahora}" RfcProvCertif="SIMULADO"/></cfdi:Complemento>
</cfdi:Comprobante>`;
    return { pacId: `sim_${uuid}`, uuid, xml, simulada: true };
  }

  async cancelar() {}

  async pdf() {
    return null;
  }
}

let pac: Pac | null = null;
export function obtenerPac(): Pac {
  pac ??= process.env.FACTURAPI_KEY ? new Facturapi(process.env.FACTURAPI_KEY) : new Simulador();
  return pac;
}

/** Ambiente del PAC para mostrarlo en pantalla. */
export function ambientePac() {
  const llave = process.env.FACTURAPI_KEY;
  if (!llave) return { nombre: "Simulador", real: false, descripcion: "Sin PAC configurado: las facturas se simulan y NO tienen validez fiscal." };
  if (llave.startsWith("sk_test")) return { nombre: "Facturapi (pruebas)", real: false, descripcion: "Ambiente de pruebas de Facturapi: se timbra contra el SAT de pruebas, sin validez fiscal." };
  return { nombre: "Facturapi", real: true, descripcion: "Facturas reales timbradas ante el SAT." };
}
