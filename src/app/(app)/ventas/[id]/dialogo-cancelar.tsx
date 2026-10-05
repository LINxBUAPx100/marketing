"use client";

import { Ban } from "lucide-react";
import { Campo } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/numeros";
import { cancelar } from "../acciones";

export function DialogoCancelar({ ventaId, folio, pagado }: { ventaId: string; folio: string; pagado: number }) {
  return (
    <DialogoFormulario
      titulo={`Cancelar ${folio}`}
      descripcion={
        pagado > 0
          ? `Se anulan sus pagos (${formatoMoneda(pagado)}) y regresa al inventario lo vendido. Si algún pago ya entró en un corte de caja, se registra como devolución en el periodo actual.`
          : "Regresa al inventario lo vendido. La venta queda en el historial como cancelada."
      }
      accion={cancelar}
      textoGuardar="Cancelar venta"
      disparador={
        <Button variant="destructive">
          <Ban /> Cancelar
        </Button>
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="ventaId" value={ventaId} />
          <Campo etiqueta="Motivo de la cancelación" nombre="motivo" required autoFocus placeholder="Ej. el cliente cambió el diseño" errores={e.motivo} />
        </>
      )}
    </DialogoFormulario>
  );
}
