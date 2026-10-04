// Cálculos puros de los reportes.

const DIA_MS = 86_400_000;

/** Lista de días "2026-10-01"… entre dos fechas, incluidas. */
export function diasEntre(desde: string, hasta: string) {
  const dias: string[] = [];
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  for (let d = Date.parse(`${desde}T00:00:00Z`); d <= fin && dias.length < 1000; d += DIA_MS) dias.push(new Date(d).toISOString().slice(0, 10));
  return dias;
}

/** Rellena con ceros los días sin ventas para que la gráfica no se salte fechas. */
export function serieDiaria<T extends { dia: string }>(desde: string, hasta: string, filas: T[], vacio: Omit<T, "dia">): T[] {
  const porDia = new Map(filas.map((f) => [f.dia, f]));
  return diasEntre(desde, hasta).map((dia) => porDia.get(dia) ?? ({ ...vacio, dia } as T));
}

/** Periodo inmediato anterior de la misma duración, para comparar. */
export function periodoAnterior(desde: string, hasta: string) {
  const dias = diasEntre(desde, hasta).length;
  const fin = Date.parse(`${desde}T00:00:00Z`) - DIA_MS;
  return {
    desde: new Date(fin - (dias - 1) * DIA_MS).toISOString().slice(0, 10),
    hasta: new Date(fin).toISOString().slice(0, 10),
  };
}

/** Variación en puntos base (1000 = +10 %). Null si no hay base para comparar. */
export function variacion(actual: number, anterior: number) {
  if (anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 10000);
}

export const promedio = (total: number, n: number) => (n > 0 ? Math.round(total / n) : 0);

/** Parte proporcional en puntos base, para barras y porcentajes de participación. */
export const participacion = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 10000) : 0);
