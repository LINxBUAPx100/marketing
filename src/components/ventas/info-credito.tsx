import { Handshake } from "lucide-react";
import { formatoMoneda } from "@/lib/numeros";
import { rebasaLimite } from "@/lib/ventas/precios";
import type { InfoCliente } from "./use-reglas-cliente";

/** Convenio, saldo y límite de crédito del cliente, y si esta venta lo rebasaría. */
export function InfoCredito({ info, saldoNuevo }: { info: InfoCliente; saldoNuevo: number }) {
  const { reglas, saldo, limiteCredito, diasCredito } = info;
  const rebasa = rebasaLimite(saldo, saldoNuevo, limiteCredito);
  if (!reglas.convenio && !saldo) return null;
  return (
    <div className={`grid gap-0.5 rounded-lg border px-3 py-2 text-xs ${rebasa ? "border-destructive/50 bg-destructive/5" : "bg-muted/40"}`}>
      {reglas.convenio && (
        <p className="flex items-center gap-1.5 font-medium">
          <Handshake className="size-3.5" />
          Convenio
          {reglas.convenio.descuentoBp ? ` · ${reglas.convenio.descuentoBp / 100} % de descuento` : ""}
          {Object.keys(reglas.convenio.precios).length ? ` · ${Object.keys(reglas.convenio.precios).length} precios especiales` : ""}
          {diasCredito ? ` · ${diasCredito} días de crédito` : ""}
        </p>
      )}
      <p className="text-muted-foreground">
        Debe {formatoMoneda(saldo)}
        {limiteCredito != null && ` de un límite de ${formatoMoneda(limiteCredito)}`}
      </p>
      {rebasa && <p className="text-destructive font-medium">Con esta venta rebasaría su límite de crédito. Cobra más ahora o pide autorización.</p>}
    </div>
  );
}
