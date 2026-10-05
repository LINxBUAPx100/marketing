// Contadores, impresiones fantasma y consumibles. Funciones puras.

export const ETIQUETA_TIPO = { byn: "Blanco y negro", color: "Color", gran_formato: "Gran formato (m²)" } as const;
export type TipoImpresion = keyof typeof ETIQUETA_TIPO;

export const ETIQUETA_MOTIVO_MERMA = {
  atasco: "Atasco de papel",
  prueba: "Prueba de color o de impresión",
  error_impresion: "Error al imprimir",
  error_diseno: "Error en el diseño",
  defecto_material: "Material defectuoso",
  otro: "Otro",
} as const;

export type Lectura = { valor: number; fecha: Date };

/**
 * Impresiones que marcó un contador en [inicio, fin).
 * Base: la última lectura antes del periodo; si no hay, la primera dentro del periodo.
 * Final: la última lectura dentro del periodo. Sin lecturas suficientes, null.
 */
export function impresionesEnPeriodo(lecturas: Lectura[], inicio: Date, fin: Date) {
  const ordenadas = [...lecturas].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const antes = ordenadas.filter((l) => l.fecha < inicio).at(-1);
  const dentro = ordenadas.filter((l) => l.fecha >= inicio && l.fecha < fin);
  const base = antes ?? dentro[0];
  const final = dentro.at(-1);
  if (!base || !final || base === final) return null;
  return { desde: base.valor, hasta: final.valor, impresiones: final.valor - base.valor };
}

/** Una lectura nueva no puede ser menor que la anterior (los contadores solo suben). */
export function validarLectura(nueva: number, anterior: number | null) {
  if (!Number.isFinite(nueva) || nueva < 0) return "Escribe la lectura que marca el equipo.";
  if (anterior != null && nueva < anterior) return `La lectura no puede ser menor que la anterior (${anterior}).`;
  return null;
}

/**
 * Impresiones fantasma: lo que marcó el contador y no está justificado por ventas ni mermas.
 * Positivo = salieron impresiones que nadie cobró. Negativo = se vendió más de lo impreso
 * (normalmente porque falta capturar una lectura o el producto tiene mal sus impresiones por unidad).
 */
export function impresionesFantasma(d: { contador: number; vendidas: number; mermas: number }) {
  const justificadas = d.vendidas + d.mermas;
  const fantasma = Math.round((d.contador - justificadas) * 1000) / 1000;
  return { fantasma, porcentaje: d.contador > 0 ? fantasma / d.contador : null };
}

/** Cuánto lleva un consumible y cuándo se acabaría al ritmo actual. */
export function desgasteConsumible(d: {
  lecturaInstalacion: number;
  lecturaActual: number;
  rendimiento: number;
  instaladoEn: Date;
  ahora?: Date;
}) {
  const ahora = d.ahora ?? new Date();
  const usado = Math.max(0, d.lecturaActual - d.lecturaInstalacion);
  const restante = d.rendimiento - usado;
  const dias = Math.max(1, (ahora.getTime() - d.instaladoEn.getTime()) / 86_400_000);
  const porDia = usado / dias;
  return {
    usado,
    restante,
    porcentaje: d.rendimiento > 0 ? usado / d.rendimiento : 0,
    porDia,
    // Solo se estima con al menos un día de uso real.
    seAcabaEn: porDia > 0 && restante > 0 ? new Date(ahora.getTime() + (restante / porDia) * 86_400_000) : null,
  };
}

/** Costo por cada 1,000 impresiones, en centavos. */
export const costoPorMil = (costo: number, impresiones: number) => (impresiones > 0 ? Math.round((costo * 1000) / impresiones) : null);
