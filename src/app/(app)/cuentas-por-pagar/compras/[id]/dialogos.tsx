"use client";

import { Ban, HandCoins } from "lucide-react";
import { useState } from "react";
import { Campo, Selector } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { ETIQUETA_METODO, METODOS } from "@/lib/caja/resumen";
import { centavosATexto, formatoMoneda } from "@/lib/numeros";
import { cancelar, pagar } from "../../acciones";

export function DialogoPagar({ compraId, saldo, sucursal }: { compraId: string; saldo: number; sucursal: string | null }) {
  const [metodo, setMetodo] = useState("efectivo");
  return (
    <DialogoFormulario
      titulo="Pagar al proveedor"
      descripcion={`Saldo: ${formatoMoneda(saldo)}. Puedes pagar una parte.`}
      accion={pagar}
      textoGuardar="Registrar pago"
      disparador={
        <Button>
          <HandCoins /> Registrar pago
        </Button>
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="compraId" value={compraId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Monto" nombre="monto" inputMode="decimal" defaultValue={centavosATexto(saldo)} required autoFocus errores={e.monto} />
            <Selector etiqueta="Método" nombre="metodo" value={metodo} onChange={(ev) => setMetodo(ev.target.value)} errores={e.metodo}>
              {METODOS.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_METODO[m]}
                </option>
              ))}
            </Selector>
          </div>
          <Campo etiqueta="Referencia" nombre="referencia" placeholder="Folio de transferencia, número de cheque…" errores={e.referencia} />
          {metodo === "efectivo" && sucursal && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="desdeCaja" defaultChecked className="accent-primary mt-0.5 size-4" />
              <span>
                Salió de la caja de {sucursal}
                <span className="text-muted-foreground block text-xs">Queda como gasto «Pago a proveedor» en el corte.</span>
              </span>
            </label>
          )}
        </>
      )}
    </DialogoFormulario>
  );
}

export function DialogoCancelarCompra({ compraId }: { compraId: string }) {
  return (
    <DialogoFormulario
      titulo="Cancelar compra"
      descripcion="Las existencias que entraron con esta compra se restan otra vez."
      accion={cancelar}
      textoGuardar="Cancelar compra"
      disparador={
        <Button variant="destructive">
          <Ban /> Cancelar
        </Button>
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="compraId" value={compraId} />
          <Campo etiqueta="Motivo" nombre="motivo" placeholder="Ej. se capturó dos veces" required autoFocus errores={e.motivo} />
        </>
      )}
    </DialogoFormulario>
  );
}
