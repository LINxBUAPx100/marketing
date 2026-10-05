"use client";

import { Campo, MensajeFormulario } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { useFormulario } from "@/hooks/use-formulario";
import { configurarNegocio } from "../acciones";

export function FormularioInicial() {
  const { estado, onSubmit, enviando, errores: e } = useFormulario(configurarNegocio);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <MensajeFormulario estado={estado} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre del negocio" nombre="negocio" required errores={e.negocio} />
        <Campo etiqueta="Primera sucursal" nombre="sucursal" defaultValue="Matriz" required errores={e.sucursal} />
      </div>
      <p className="text-muted-foreground border-t pt-4 text-sm">Tu cuenta de administración</p>
      <Campo etiqueta="Tu nombre" nombre="nombre" autoComplete="name" required errores={e.nombre} />
      <Campo etiqueta="Correo" nombre="correo" type="email" autoComplete="email" required errores={e.correo} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Contraseña" nombre="password" type="password" autoComplete="new-password" required errores={e.password} />
        <Campo etiqueta="Confirmar contraseña" nombre="confirmar" type="password" autoComplete="new-password" required errores={e.confirmar} />
      </div>
      <Button type="submit" size="lg" disabled={enviando}>
        {enviando ? "Creando…" : "Crear y entrar"}
      </Button>
    </form>
  );
}
