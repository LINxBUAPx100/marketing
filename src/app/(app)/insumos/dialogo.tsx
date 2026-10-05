"use client";

import { Pencil, Plus } from "lucide-react";
import { Campo } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { guardarInsumo } from "./acciones";

const UNIDADES = ["hoja", "pliego", "ml", "litro", "m²", "metro lineal", "rollo", "pieza", "gramo", "kg", "paquete"];

export type ValoresInsumo = { id: string; nombre: string; codigo: string; unidad: string; costo: string; existenciaMinima: string; activo: boolean };

export function DialogoInsumo({ insumo, sucursal }: { insumo?: ValoresInsumo; sucursal: string | null }) {
  const editando = !!insumo;
  return (
    <DialogoFormulario
      titulo={editando ? `Editar ${insumo.nombre}` : "Nuevo insumo"}
      descripcion="Lo que se consume al producir: papel, tinta, lona, vinil…"
      accion={guardarInsumo}
      disparador={
        editando ? (
          <Button variant="outline">
            <Pencil /> Editar
          </Button>
        ) : (
          <Button>
            <Plus /> Nuevo insumo
          </Button>
        )
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="id" value={insumo?.id ?? ""} />
          <Campo etiqueta="Nombre" nombre="nombre" defaultValue={insumo?.nombre} placeholder="Ej. Papel couché 150 g carta" required autoFocus errores={e.nombre} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Código" nombre="codigo" defaultValue={insumo?.codigo} errores={e.codigo} />
            <Campo etiqueta="Se mide en" nombre="unidad" defaultValue={insumo?.unidad ?? "hoja"} list="unidades-insumo" required errores={e.unidad} />
            <datalist id="unidades-insumo">
              {UNIDADES.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <Campo
              etiqueta="Costo por unidad ($)"
              nombre="costo"
              inputMode="decimal"
              defaultValue={insumo?.costo}
              placeholder="0.725"
              ayuda="Hasta 4 decimales. Se actualiza al registrar compras."
              errores={e.costo}
            />
            <Campo etiqueta="Avisar cuando queden" nombre="existenciaMinima" type="number" step="any" min="0" defaultValue={insumo?.existenciaMinima ?? "0"} errores={e.existenciaMinima} />
          </div>
          {!editando && (
            <Campo
              etiqueta={`Existencia inicial${sucursal ? ` en ${sucursal}` : ""}`}
              nombre="existenciaInicial"
              type="number"
              step="any"
              defaultValue="0"
              errores={e.existenciaInicial}
            />
          )}
          {editando && (
            <label className="flex items-center gap-2 text-sm">
              <input type="hidden" name="activo" value="false" />
              <input type="checkbox" name="activo" value="true" defaultChecked={insumo.activo} className="accent-primary size-4" />
              Insumo activo
            </label>
          )}
        </>
      )}
    </DialogoFormulario>
  );
}
