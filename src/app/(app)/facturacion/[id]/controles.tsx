"use client";

import { Ban, FileSymlink } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Campo, Selector } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { MOTIVOS_CANCELACION } from "@/lib/facturacion/reglas";
import { cancelar, complemento } from "../acciones";

export function DialogoCancelarFactura({ id, folio }: { id: string; folio: string }) {
  const [motivo, setMotivo] = useState("02");
  return (
    <DialogoFormulario
      titulo={`Cancelar ${folio}`}
      descripcion="La cancelación se envía al SAT. Si el receptor debe aceptarla, puede tardar hasta 72 horas."
      accion={cancelar}
      textoGuardar="Cancelar factura"
      disparador={
        <Button variant="destructive">
          <Ban /> Cancelar
        </Button>
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="id" value={id} />
          <Selector etiqueta="Motivo (catálogo del SAT)" nombre="motivo" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} errores={e.motivo}>
            {MOTIVOS_CANCELACION.map(([clave, texto]) => (
              <option key={clave} value={clave}>
                {clave} · {texto}
              </option>
            ))}
          </Selector>
          {motivo === "01" && <Campo etiqueta="UUID de la factura que la sustituye" nombre="sustitucion" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required errores={e.sustitucion} />}
        </>
      )}
    </DialogoFormulario>
  );
}

export function BotonComplemento({ facturaId, pagoId }: { facturaId: string; pagoId: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          const r = await complemento(facturaId, pagoId);
          if (!r.ok) toast.error(r.mensaje);
          else toast.success("Complemento de pago emitido.");
        })
      }
    >
      <FileSymlink /> {pendiente ? "Timbrando…" : "Emitir complemento"}
    </Button>
  );
}
