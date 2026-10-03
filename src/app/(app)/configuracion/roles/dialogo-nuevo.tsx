"use client";

import { Plus } from "lucide-react";
import { Campo } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { guardarRol } from "../acciones";

export function DialogoNuevoRol() {
  return (
    <DialogoFormulario
      titulo="Nuevo rol"
      descripcion="Después de crearlo eliges sus permisos."
      accion={guardarRol}
      textoGuardar="Crear rol"
      disparador={
        <Button>
          <Plus /> Nuevo rol
        </Button>
      }
    >
      {(e) => (
        <>
          <Campo etiqueta="Nombre" nombre="nombre" placeholder="Ej. Diseño, Encargado de sucursal" required errores={e.nombre} />
          <Campo etiqueta="Descripción" nombre="descripcion" errores={e.descripcion} />
        </>
      )}
    </DialogoFormulario>
  );
}
