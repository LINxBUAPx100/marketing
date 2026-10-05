"use client";

import { CloudOff, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { registrarVenta } from "@/app/(app)/ventas/acciones";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EVENTO_COLA, esErrorDeRed, quitarPendiente, guardarPendiente, ventasPendientes, type VentaPendiente } from "@/lib/offline/cola";
import { formatoFechaHora, formatoMoneda } from "@/lib/numeros";

function suscribirConexion(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

/**
 * Indicador de conexión y sincronización de las ventas capturadas sin internet.
 * Al volver la conexión las manda en orden; si el servidor rechaza una, se queda con el motivo.
 */
export function VentasPendientes() {
  const router = useRouter();
  const [pendientes, setPendientes] = useState<VentaPendiente[]>([]);
  const enLinea = useSyncExternalStore(suscribirConexion, () => navigator.onLine, () => true);
  const [enviando, setEnviando] = useState(false);
  const ocupado = useRef(false);

  const cargar = useCallback(() => {
    ventasPendientes()
      .then(setPendientes)
      .catch(() => setPendientes([]));
  }, []);

  const sincronizar = useCallback(async () => {
    if (ocupado.current || !navigator.onLine) return;
    ocupado.current = true;
    setEnviando(true);
    let enviadas = 0;
    try {
      for (const v of await ventasPendientes()) {
        if (v.error) continue;
        try {
          const r = await registrarVenta(v.datos);
          if (r.ok) {
            await quitarPendiente(v.clave);
            enviadas++;
            toast.success(`Venta sin conexión registrada como ${r.folio}.`);
          } else {
            await guardarPendiente({ ...v, error: r.mensaje });
            toast.error(`Una venta sin conexión no se pudo registrar: ${r.mensaje}`);
          }
        } catch (e) {
          if (esErrorDeRed(e)) break;
          throw e;
        }
      }
    } finally {
      ocupado.current = false;
      setEnviando(false);
      cargar();
      if (enviadas) router.refresh();
    }
  }, [cargar, router]);

  useEffect(() => {
    const alReconectar = () => void sincronizar();
    cargar();
    void sincronizar();
    window.addEventListener("online", alReconectar);
    window.addEventListener(EVENTO_COLA, cargar);
    // Por si el navegador dice "en línea" pero el servidor no respondía: reintento cada minuto.
    const intervalo = setInterval(() => void sincronizar(), 60_000);
    return () => {
      window.removeEventListener("online", alReconectar);
      window.removeEventListener(EVENTO_COLA, cargar);
      clearInterval(intervalo);
    };
  }, [cargar, sincronizar]);

  if (enLinea && pendientes.length === 0) return null;

  const conError = pendientes.filter((p) => p.error).length;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className={conError ? "text-destructive" : "text-amber-700"}>
            <CloudOff />
            <span className="hidden sm:inline">{enLinea ? "" : "Sin conexión"}</span>
            {pendientes.length > 0 && (
              <span className="rounded-full bg-current/15 px-1.5 text-xs tabular-nums">
                {pendientes.length}
                <span className="sr-only"> ventas sin enviar</span>
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80">
        <div className="grid gap-3 text-sm">
          <p className="font-medium">{enLinea ? "Ventas por enviar" : "Sin conexión"}</p>
          <p className="text-muted-foreground text-xs">
            {enLinea
              ? "Estas ventas se capturaron sin internet. Se envían solas; las que el servidor rechazó necesitan revisión."
              : "Puedes seguir cobrando en Nueva venta: las ventas se guardan en este equipo y se envían al volver el internet. No cierres sesión ni borres los datos del navegador."}
          </p>
          {pendientes.length > 0 && (
            <ul className="grid max-h-64 gap-2 overflow-y-auto">
              {pendientes.map((v) => (
                <li key={v.clave} className="rounded-lg border p-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{v.cliente ?? "Público en general"}</span>
                    <span className="tabular-nums">{formatoMoneda(v.total)}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatoFechaHora(new Date(v.capturadaEn))} · {v.sucursal}
                  </p>
                  {v.error && (
                    <div className="mt-1 flex items-start justify-between gap-2">
                      <p className="text-destructive text-xs">{v.error}</p>
                      <div className="flex shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Reintentar"
                          title="Reintentar"
                          onClick={async () => {
                            await guardarPendiente({ ...v, error: undefined });
                            void sincronizar();
                          }}
                        >
                          <RefreshCw />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Descartar venta"
                          title="Descartar venta"
                          onClick={async () => {
                            if (!window.confirm("¿Descartar esta venta? No se registrará y el dinero cobrado no quedará en caja.")) return;
                            await quitarPendiente(v.clave);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {enLinea && pendientes.some((p) => !p.error) && (
            <Button size="sm" onClick={() => void sincronizar()} disabled={enviando}>
              <RefreshCw className={enviando ? "animate-spin" : undefined} /> {enviando ? "Enviando…" : "Enviar ahora"}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
