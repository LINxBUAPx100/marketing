// La imprenta opera en hora del centro de México (UTC−6, sin horario de verano desde 2022).

const ZONA = "America/Mexico_City";
const DIA_MS = 86_400_000;

/** Fecha de hoy en México como "2026-10-03". */
export const hoyEnMexico = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());

/** "2026-10-03" → instante en que empieza ese día en México. */
export const inicioDelDia = (fecha: string) => new Date(`${fecha}T00:00:00-06:00`);

/** Rango [desde, hasta) que cubre los días indicados completos. */
export const rangoDeDias = (desde: string, hasta: string) => ({
  inicio: inicioDelDia(desde),
  fin: new Date(inicioDelDia(hasta).getTime() + DIA_MS),
});

export const esFecha = (v: string | undefined): v is string => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");
