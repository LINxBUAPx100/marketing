"use client";

import { Campo, MensajeFormulario } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { useFormulario } from "@/hooks/use-formulario";
import { iniciarSesion } from "../acciones";

export function FormularioLogin() {
  const { estado, onSubmit, enviando } = useFormulario(iniciarSesion);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <MensajeFormulario estado={estado} />
      <Campo etiqueta="Correo" nombre="correo" type="email" autoComplete="email" required autoFocus errores={estado?.errores?.correo} />
      <Campo etiqueta="Contraseña" nombre="password" type="password" autoComplete="current-password" required errores={estado?.errores?.password} />
      <Button type="submit" size="lg" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
