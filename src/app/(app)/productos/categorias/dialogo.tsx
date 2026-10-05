"use client";

import { Pencil, Plus } from "lucide-react";
import { Campo } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { guardarCategoria } from "../acciones";

export function DialogoCategoria({ categoria }: { categoria?: { id: string; nombre: string; activa: boolean; comision: string } }) {
  const editando = !!categoria;
  return (
    <DialogoFormulario
      titulo={editando ? `Editar ${categoria.nombre}` : "Nueva categoría"}
      accion={guardarCategoria}
      disparador={
        editando ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${categoria.nombre}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> Nueva categoría
          </Button>
        )
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="id" value={categoria?.id ?? ""} />
          <Campo etiqueta="Nombre" nombre="nombre" defaultValue={categoria?.nombre} required autoFocus errores={e.nombre} />
          <Campo
            etiqueta="Comisión de esta categoría (%)"
            nombre="comision"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={categoria?.comision}
            ayuda="Vacío = cada vendedor cobra su propio porcentaje."
            errores={e.comision}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="activa" defaultChecked={categoria?.activa ?? true} className="accent-primary size-4" />
            Categoría activa
          </label>
        </>
      )}
    </DialogoFormulario>
  );
}
