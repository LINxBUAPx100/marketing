"use client";

import { Pencil, UserPlus } from "lucide-react";
import { Campo, Selector } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { guardarUsuario } from "../acciones";

type Opcion = { id: string; nombre: string };
type Usuario = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  rolId: string;
  comision: string;
  activo: boolean;
  sucursales: string[];
};

export function DialogoUsuario({ usuario, roles, sucursales }: { usuario?: Usuario; roles: Opcion[]; sucursales: Opcion[] }) {
  const editando = !!usuario;
  return (
    <DialogoFormulario
      titulo={editando ? `Editar a ${usuario.nombre}` : "Nuevo usuario"}
      accion={guardarUsuario}
      disparador={
        editando ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar a ${usuario.nombre}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <UserPlus /> Nuevo usuario
          </Button>
        )
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="id" value={usuario?.id ?? ""} />
          <Campo etiqueta="Nombre" nombre="nombre" defaultValue={usuario?.nombre} autoComplete="off" required errores={e.nombre} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Correo" nombre="correo" type="email" defaultValue={usuario?.correo} autoComplete="off" required errores={e.correo} />
            <Campo etiqueta="Teléfono" nombre="telefono" type="tel" defaultValue={usuario?.telefono} errores={e.telefono} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Selector etiqueta="Rol" nombre="rolId" defaultValue={usuario?.rolId ?? roles.find((r) => r.nombre !== "Administrador")?.id} required errores={e.rolId}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </Selector>
            <Campo
              etiqueta="Comisión sobre ventas (%)"
              nombre="comision"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={usuario?.comision ?? "0"}
              errores={e.comision}
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">Sucursales donde trabaja</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {sucursales.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="sucursales"
                    value={s.id}
                    defaultChecked={usuario ? usuario.sucursales.includes(s.id) : sucursales.length === 1}
                    className="accent-primary size-4"
                  />
                  {s.nombre}
                </label>
              ))}
            </div>
            {e.sucursales && <p className="text-destructive text-sm">{e.sucursales[0]}</p>}
          </fieldset>

          <Campo
            etiqueta={editando ? "Nueva contraseña" : "Contraseña"}
            nombre="password"
            type="password"
            autoComplete="new-password"
            required={!editando}
            ayuda={editando ? "Déjala vacía para no cambiarla. Al cambiarla se cierran sus sesiones." : "Mínimo 8 caracteres."}
            errores={e.password}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="activo" defaultChecked={usuario?.activo ?? true} className="accent-primary size-4" />
            Puede entrar al sistema
          </label>
        </>
      )}
    </DialogoFormulario>
  );
}
