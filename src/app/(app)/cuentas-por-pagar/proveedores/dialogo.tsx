"use client";

import { Pencil, Plus } from "lucide-react";
import { Campo } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoFormulario } from "@/lib/formulario";
import { guardarProveedor } from "../acciones";

export type ValoresProveedor = {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  correo: string;
  rfc: string;
  diasCredito: string;
  notas: string;
  activo: boolean;
};

export function DialogoProveedor({
  proveedor,
  disparador,
  alGuardar,
}: {
  proveedor?: ValoresProveedor;
  disparador?: React.ReactElement;
  alGuardar?: (r: NonNullable<EstadoFormulario>) => void;
}) {
  const editando = !!proveedor;
  return (
    <DialogoFormulario
      titulo={editando ? `Editar ${proveedor.nombre}` : "Nuevo proveedor"}
      accion={guardarProveedor}
      alGuardar={alGuardar}
      disparador={
        disparador ??
        (editando ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${proveedor.nombre}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> Nuevo proveedor
          </Button>
        ))
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="id" value={proveedor?.id ?? ""} />
          <Campo etiqueta="Nombre" nombre="nombre" defaultValue={proveedor?.nombre} placeholder="Ej. Papelera del Centro" required autoFocus errores={e.nombre} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Contacto" nombre="contacto" defaultValue={proveedor?.contacto} errores={e.contacto} />
            <Campo etiqueta="Teléfono" nombre="telefono" type="tel" defaultValue={proveedor?.telefono} errores={e.telefono} />
            <Campo etiqueta="Correo" nombre="correo" type="email" defaultValue={proveedor?.correo} errores={e.correo} />
            <Campo etiqueta="RFC" nombre="rfc" defaultValue={proveedor?.rfc} maxLength={13} className="uppercase" errores={e.rfc} />
            <Campo
              etiqueta="Días de crédito"
              nombre="diasCredito"
              type="number"
              min="0"
              max="365"
              defaultValue={proveedor?.diasCredito ?? "0"}
              ayuda="0 = se paga de contado"
              errores={e.diasCredito}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notas-proveedor">Notas</Label>
            <Textarea id="notas-proveedor" name="notas" rows={2} defaultValue={proveedor?.notas} placeholder="Qué surte, horarios de entrega…" />
          </div>
          {editando && (
            <label className="flex items-center gap-2 text-sm">
              <input type="hidden" name="activo" value="false" />
              <input type="checkbox" name="activo" value="true" defaultChecked={proveedor.activo} className="accent-primary size-4" />
              Proveedor activo
            </label>
          )}
        </>
      )}
    </DialogoFormulario>
  );
}
