"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Campo, MensajeFormulario } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFormulario } from "@/hooks/use-formulario";
import { MODULOS_PERMISOS, TODOS_LOS_PERMISOS } from "@/lib/permisos";
import { guardarRol } from "../../acciones";

type Rol = { id: string; nombre: string; descripcion: string; permisos: string[]; esAdmin: boolean };

export function FormularioRol({ rol, soloLectura }: { rol: Rol; soloLectura: boolean }) {
  const { estado, onSubmit, enviando, errores: e } = useFormulario(guardarRol);
  const [marcados, setMarcados] = useState(() => new Set(rol.esAdmin ? TODOS_LOS_PERMISOS : rol.permisos));

  useEffect(() => {
    if (estado?.ok) toast.success(estado.mensaje);
  }, [estado]);

  const alternar = (clave: string, valor: boolean) =>
    setMarcados((prev) => {
      const sig = new Set(prev);
      if (valor) sig.add(clave);
      else sig.delete(clave);
      return sig;
    });

  const alternarModulo = (claves: string[], valor: boolean) =>
    setMarcados((prev) => {
      const sig = new Set(prev);
      for (const c of claves) {
        if (valor) sig.add(c);
        else sig.delete(c);
      }
      return sig;
    });

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={rol.id} />
      {!estado?.ok && <MensajeFormulario estado={estado} />}
      <fieldset disabled={soloLectura} className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" nombre="nombre" defaultValue={rol.nombre} required errores={e.nombre} />
          <Campo etiqueta="Descripción" nombre="descripcion" defaultValue={rol.descripcion} errores={e.descripcion} />
        </div>

        <Card className="py-0">
          <CardContent className="divide-y px-0">
            {MODULOS_PERMISOS.map((m) => {
              const claves = m.acciones.map((a) => `${m.clave}.${a.clave}`);
              const todos = claves.every((c) => marcados.has(c));
              const algunos = !todos && claves.some((c) => marcados.has(c));
              return (
                <div key={m.clave} className="grid gap-2 px-4 py-3 sm:grid-cols-[13rem_1fr] sm:items-center">
                  <label className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={todos}
                      ref={(el) => {
                        if (el) el.indeterminate = algunos;
                      }}
                      onChange={(ev) => alternarModulo(claves, ev.target.checked)}
                      className="accent-primary size-4"
                      aria-label={`Todos los permisos de ${m.etiqueta}`}
                    />
                    {m.etiqueta}
                  </label>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 pl-6 sm:pl-0">
                    {m.acciones.map((a) => {
                      const clave = `${m.clave}.${a.clave}`;
                      return (
                        <label key={clave} className="text-muted-foreground has-checked:text-foreground flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="permisos"
                            value={clave}
                            checked={marcados.has(clave)}
                            onChange={(ev) => alternar(clave, ev.target.checked)}
                            className="accent-primary size-4"
                          />
                          {a.etiqueta}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </fieldset>

      {!soloLectura && (
        <div className="bg-background/90 sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <span className="text-muted-foreground mr-auto text-sm tabular-nums">
            {marcados.size} de {TODOS_LOS_PERMISOS.length} permisos
          </span>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar permisos"}
          </Button>
        </div>
      )}
    </form>
  );
}
