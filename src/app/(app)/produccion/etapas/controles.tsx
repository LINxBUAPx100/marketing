"use client";

import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { useTransition } from "react";
import { Campo, Selector } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { guardarEtapa, reordenarEtapa } from "../acciones";

type Etapa = { id: string; nombre: string; tipo: "proceso" | "listo" | "entregado"; responsableId: string; activa: boolean };

export function DialogoEtapa({ etapa, usuarios }: { etapa?: Etapa; usuarios: { id: string; nombre: string }[] }) {
  const editando = !!etapa;
  return (
    <DialogoFormulario
      titulo={editando ? `Editar ${etapa.nombre}` : "Nueva etapa"}
      descripcion={editando ? undefined : "Se agrega antes de «Listo» y «Entregado». Luego puedes moverla."}
      accion={guardarEtapa}
      disparador={
        editando ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${etapa.nombre}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> Nueva etapa
          </Button>
        )
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="id" value={etapa?.id ?? ""} />
          <Campo etiqueta="Nombre" nombre="nombre" defaultValue={etapa?.nombre} placeholder="Ej. Corte, Laminado, Revisión" required autoFocus errores={e.nombre} />
          <Selector etiqueta="Tipo" nombre="tipo" defaultValue={etapa?.tipo ?? "proceso"} errores={e.tipo}>
            <option value="proceso">Proceso del taller</option>
            <option value="listo">Listo para entregar (avisa a quien vendió)</option>
            <option value="entregado">Entregado (cierra la orden)</option>
          </Selector>
          <Selector etiqueta="Responsable por omisión" nombre="responsableId" defaultValue={etapa?.responsableId ?? ""} errores={e.responsableId}>
            <option value="">Nadie: se asigna a mano</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </Selector>
          {editando && (
            <label className="flex items-center gap-2 text-sm">
              <input type="hidden" name="activa" value="false" />
              <input type="checkbox" name="activa" value="true" defaultChecked={etapa.activa} className="accent-primary size-4" />
              Etapa activa (aparece en el tablero)
            </label>
          )}
        </>
      )}
    </DialogoFormulario>
  );
}

export function BotonesOrden({ id, primera, ultima }: { id: string; primera: boolean; ultima: boolean }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex flex-col">
      <Button variant="ghost" size="icon-xs" aria-label="Subir etapa" disabled={primera || pendiente} onClick={() => iniciar(() => reordenarEtapa(id, "subir"))}>
        <ChevronUp />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label="Bajar etapa" disabled={ultima || pendiente} onClick={() => iniciar(() => reordenarEtapa(id, "bajar"))}>
        <ChevronDown />
      </Button>
    </div>
  );
}
