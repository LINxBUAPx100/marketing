"use client";

import { Pencil, Plus } from "lucide-react";
import { Campo } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { guardarSucursal } from "../acciones";

type Sucursal = {
  id: string;
  nombre: string;
  prefijoFolio: string;
  direccion: string;
  telefono: string;
  activa: boolean;
};

export function DialogoSucursal({ sucursal }: { sucursal?: Sucursal }) {
  const editando = !!sucursal;
  return (
    <DialogoFormulario
      titulo={editando ? `Editar ${sucursal.nombre}` : "Nueva sucursal"}
      accion={guardarSucursal}
      disparador={
        editando ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${sucursal.nombre}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> Nueva sucursal
          </Button>
        )
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="id" value={sucursal?.id ?? ""} />
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Campo etiqueta="Nombre" nombre="nombre" defaultValue={sucursal?.nombre} required errores={e.nombre} />
            <Campo
              etiqueta="Prefijo"
              nombre="prefijoFolio"
              defaultValue={sucursal?.prefijoFolio}
              maxLength={5}
              className="uppercase"
              required
              errores={e.prefijoFolio}
              ayuda="Ej. CEN-0001"
            />
          </div>
          <Campo etiqueta="Dirección" nombre="direccion" defaultValue={sucursal?.direccion} errores={e.direccion} />
          <Campo etiqueta="Teléfono" nombre="telefono" type="tel" defaultValue={sucursal?.telefono} errores={e.telefono} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="activa" defaultChecked={sucursal?.activa ?? true} className="accent-primary size-4" />
            Sucursal activa
          </label>
        </>
      )}
    </DialogoFormulario>
  );
}
