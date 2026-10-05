"use client";

import { Ban, CalendarPlus, Check, ThumbsDown } from "lucide-react";
import { Campo, Selector } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { cerrar, completarSeguimiento, programarSeguimiento } from "../acciones";

export function DialogoSeguimiento({ cotizacionId, usuarios, usuarioActual, sugerencia }: { cotizacionId: string; usuarios: { id: string; nombre: string }[]; usuarioActual: string; sugerencia: string }) {
  return (
    <DialogoFormulario
      titulo="Programar seguimiento"
      descripcion="Le aparecerá como recordatorio a quien lo tenga a cargo."
      accion={programarSeguimiento}
      textoGuardar="Programar"
      disparador={
        <Button variant="outline" size="sm">
          <CalendarPlus /> Programar seguimiento
        </Button>
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="cotizacionId" value={cotizacionId} />
          <Campo etiqueta="Cuándo" nombre="fecha" type="datetime-local" defaultValue={sugerencia} required errores={e.fecha} />
          <Campo etiqueta="Qué hacer" nombre="nota" defaultValue="Llamar para confirmar si aprueba la cotización" required errores={e.nota} />
          <Selector etiqueta="A cargo de" nombre="usuarioId" defaultValue={usuarioActual} errores={e.usuarioId}>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </Selector>
        </>
      )}
    </DialogoFormulario>
  );
}

export function DialogoCompletar({ id }: { id: string }) {
  return (
    <DialogoFormulario
      titulo="Marcar seguimiento como hecho"
      accion={completarSeguimiento}
      textoGuardar="Listo"
      disparador={
        <Button variant="ghost" size="sm">
          <Check /> Hecho
        </Button>
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="id" value={id} />
          <Campo etiqueta="¿Qué pasó?" nombre="resultado" placeholder="Ej. pidió cambiar a papel couché, llamar el lunes" required autoFocus errores={e.resultado} />
        </>
      )}
    </DialogoFormulario>
  );
}

export function DialogoCerrar({ id, estado }: { id: string; estado: "rechazada" | "cancelada" }) {
  const rechazar = estado === "rechazada";
  return (
    <DialogoFormulario
      titulo={rechazar ? "El cliente no aceptó" : "Cancelar cotización"}
      descripcion={rechazar ? "Saber por qué ayuda a cotizar mejor la próxima vez." : "Quedará en el historial como cancelada."}
      accion={cerrar}
      textoGuardar={rechazar ? "Marcar rechazada" : "Cancelar cotización"}
      disparador={
        rechazar ? (
          <Button variant="outline">
            <ThumbsDown /> No aceptó
          </Button>
        ) : (
          <Button variant="ghost">
            <Ban /> Cancelar
          </Button>
        )
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="estado" value={estado} />
          <Campo etiqueta="Motivo" nombre="motivo" placeholder={rechazar ? "Ej. encontró un precio más bajo" : "Ej. se duplicó"} required autoFocus errores={e.motivo} />
        </>
      )}
    </DialogoFormulario>
  );
}
