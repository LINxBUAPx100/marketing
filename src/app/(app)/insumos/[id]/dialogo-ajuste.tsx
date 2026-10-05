"use client";

import { SlidersHorizontal } from "lucide-react";
import { Campo } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { formatoCantidad } from "@/lib/numeros";
import { ajustarInsumo } from "../acciones";

export function DialogoAjusteInsumo({ insumoId, sucursal, actual, unidad }: { insumoId: string; sucursal: { id: string; nombre: string }; actual: number; unidad: string }) {
  return (
    <DialogoFormulario
      titulo={`Ajustar existencia en ${sucursal.nombre}`}
      descripcion={`El sistema tiene ${formatoCantidad(actual)} ${unidad}. Escribe lo que contaste y se registra la diferencia.`}
      accion={ajustarInsumo}
      textoGuardar="Ajustar"
      disparador={
        <Button variant="ghost" size="icon-sm" aria-label={`Ajustar existencia en ${sucursal.nombre}`}>
          <SlidersHorizontal />
        </Button>
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="insumoId" value={insumoId} />
          <input type="hidden" name="sucursalId" value={sucursal.id} />
          <Campo etiqueta="Cantidad contada" nombre="cantidad" type="number" step="any" defaultValue={String(actual)} required autoFocus errores={e.cantidad} />
          <Campo etiqueta="Motivo" nombre="nota" placeholder="Ej. conteo semanal, hojas dañadas en la impresora" errores={e.nota} />
        </>
      )}
    </DialogoFormulario>
  );
}
