// Al arrancar el servidor: programa el respaldo automático diario (ver src/lib/respaldos-automaticos.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // En plataformas sin servidor permanente (Vercel) no hay proceso que viva: ahí se usan los respaldos de Supabase.
  if (process.env.RESPALDOS_AUTOMATICOS === "0" || process.env.VERCEL) return;

  const { db } = await import("./db");
  const { respaldoDelDia } = await import("./lib/respaldos-automaticos");
  const revisar = async () => {
    try {
      const hecho = await respaldoDelDia(db);
      if (hecho) console.log(`Respaldo automático: ${hecho.nombre} (${Math.round(hecho.bytes / 1024)} KB)`);
    } catch (e) {
      console.error("Falló el respaldo automático", e);
    }
  };
  // Primer intento a los 2 minutos de arrancar y luego cada hora (solo respalda una vez al día).
  setTimeout(revisar, 120_000).unref();
  setInterval(revisar, 3_600_000).unref();
}
