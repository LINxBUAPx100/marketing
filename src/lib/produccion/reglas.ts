// Reglas de producción: funciones puras, sin base de datos.

export const ETAPAS_INICIALES = [
  { nombre: "Diseño", tipo: "proceso" },
  { nombre: "Impresión", tipo: "proceso" },
  { nombre: "Acabado", tipo: "proceso" },
  { nombre: "Listo para entregar", tipo: "listo" },
  { nombre: "Entregado", tipo: "entregado" },
] as const;

export type Urgencia = "atrasada" | "hoy" | "manana" | "a-tiempo" | "sin-fecha";

const DIA_MS = 86_400_000;
/** Día calendario en México (UTC−6) como número, para comparar "hoy" y "mañana". */
const diaMexico = (d: Date) => Math.floor((d.getTime() - 6 * 3_600_000) / DIA_MS);

/** Qué tan urgente es una orden según su fecha compromiso. */
export function urgencia(fechaCompromiso: Date | null, ahora = new Date()): Urgencia {
  if (!fechaCompromiso) return "sin-fecha";
  if (fechaCompromiso.getTime() < ahora.getTime()) return "atrasada";
  const dias = diaMexico(fechaCompromiso) - diaMexico(ahora);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "manana";
  return "a-tiempo";
}

export const ETIQUETA_URGENCIA: Record<Urgencia, string> = {
  atrasada: "Atrasada",
  hoy: "Vence hoy",
  manana: "Vence mañana",
  "a-tiempo": "A tiempo",
  "sin-fecha": "Sin fecha",
};

export type EventoTiempo = { ordenId: string; etapaId: string; creadoEn: Date };

/**
 * Cuánto tiempo pasó cada orden en cada etapa, a partir del historial.
 * Una etapa dura desde que la orden llega hasta el siguiente cambio de etapa.
 * La etapa en curso cuenta hasta `ahora`. Devuelve horas promedio por etapa.
 */
export function tiemposPorEtapa(eventos: EventoTiempo[], ahora = new Date()) {
  const porOrden = new Map<string, EventoTiempo[]>();
  for (const e of eventos) {
    const lista = porOrden.get(e.ordenId) ?? [];
    lista.push(e);
    porOrden.set(e.ordenId, lista);
  }

  const acumulado = new Map<string, { horas: number; ordenes: Set<string> }>();
  for (const [ordenId, lista] of porOrden) {
    lista.sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime());
    // Los cambios de responsable repiten la etapa: solo cuentan las entradas a una etapa nueva.
    const entradas = lista.filter((e, i) => i === 0 || e.etapaId !== lista[i - 1].etapaId);
    entradas.forEach((e, i) => {
      const fin = entradas[i + 1]?.creadoEn ?? ahora;
      const a = acumulado.get(e.etapaId) ?? { horas: 0, ordenes: new Set<string>() };
      a.horas += (fin.getTime() - e.creadoEn.getTime()) / 3_600_000;
      a.ordenes.add(ordenId);
      acumulado.set(e.etapaId, a);
    });
  }

  return new Map([...acumulado].map(([etapaId, a]) => [etapaId, { promedioHoras: a.horas / a.ordenes.size, ordenes: a.ordenes.size }]));
}

/** "3 h", "2 d 4 h", "25 min" */
export function formatoDuracion(horas: number) {
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 24) return `${Math.round(horas)} h`;
  const d = Math.floor(horas / 24);
  const h = Math.round(horas - d * 24);
  return h ? `${d} d ${h} h` : `${d} d`;
}

/** Estado visible de una cotización (la vencida se calcula). */
export function estadoCotizacion(c: { estado: "abierta" | "aceptada" | "rechazada" | "cancelada"; vigenciaHasta: Date }, ahora = new Date()) {
  if (c.estado === "abierta" && c.vigenciaHasta.getTime() < ahora.getTime()) return "vencida" as const;
  return c.estado;
}
