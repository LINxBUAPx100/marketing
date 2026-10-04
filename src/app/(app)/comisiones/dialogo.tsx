"use client";

import { HandCoins } from "lucide-react";
import { Campo } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/numeros";
import { pagar } from "./acciones";

export function DialogoPagarComisiones({ usuarioId, nombre, monto, sucursal }: { usuarioId: string; nombre: string; monto: number; sucursal: string | null }) {
  return (
    <DialogoFormulario
      titulo={`Pagar comisiones a ${nombre}`}
      descripcion={`${formatoMoneda(monto)} de ventas ya cobradas. Las de ventas con saldo se pagan cuando el cliente liquide.`}
      accion={pagar}
      textoGuardar={`Pagar ${formatoMoneda(monto)}`}
      disparador={
        <Button size="sm">
          <HandCoins /> Pagar
        </Button>
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="usuarioId" value={usuarioId} />
          {sucursal && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="desdeCaja" defaultChecked className="accent-primary mt-0.5 size-4" />
              <span>
                Sale en efectivo de la caja de {sucursal}
                <span className="text-muted-foreground block text-xs">Queda como gasto «Comisiones» en el corte.</span>
              </span>
            </label>
          )}
          <Campo etiqueta="Notas" nombre="notas" placeholder="Ej. semana del 28 sep al 3 oct" errores={e.notas} />
        </>
      )}
    </DialogoFormulario>
  );
}
