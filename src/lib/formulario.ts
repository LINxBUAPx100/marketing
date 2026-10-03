import type { z } from "zod";

/** Resultado que devuelven las acciones de formulario a useActionState. */
export type EstadoFormulario = {
  ok?: boolean;
  mensaje?: string;
  errores?: Record<string, string[] | undefined>;
} | undefined;

export function erroresDe(error: z.ZodError): EstadoFormulario {
  const errores: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const campo = String(issue.path[0] ?? "_");
    (errores[campo] ??= []).push(issue.message);
  }
  return { errores, mensaje: "Revisa los campos marcados." };
}

/** FormData → objeto plano, para validarlo con Zod. */
export const datosDe = (formData: FormData) => Object.fromEntries(formData);

/** "" → undefined, para campos opcionales. */
export const vacioANull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
