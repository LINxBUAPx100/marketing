"use client";

import { startTransition, useActionState } from "react";
import type { EstadoFormulario } from "@/lib/formulario";

type Accion = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

/**
 * Como useActionState, pero envía desde onSubmit. Así React no vacía el formulario
 * cuando la acción regresa errores y la persona no pierde lo que escribió.
 */
export function useFormulario(accion: Accion) {
  const [estado, enviar, enviando] = useActionState(accion, undefined);
  const onSubmit = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formData = new FormData(evento.currentTarget);
    startTransition(() => enviar(formData));
  };
  return { estado, onSubmit, enviando, errores: estado?.errores ?? {} };
}
