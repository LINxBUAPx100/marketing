import { z } from "zod";
import { aCentavos } from "./numeros";

/** Resultado que devuelven las acciones de formulario a useActionState. */
export type EstadoFormulario = {
  ok?: boolean;
  mensaje?: string;
  errores?: Record<string, string[] | undefined>;
  /** Datos de lo que se guardó, para quien abrió el formulario (p. ej. el cliente recién creado). */
  datos?: Record<string, unknown>;
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

/** Campo de dinero escrito en pesos → centavos. */
export const dinero = (mensaje = "Escribe un importe válido.") =>
  z.preprocess((v) => aCentavos(v), z.number({ error: mensaje }).int().min(0, { error: "No puede ser negativo." }));

/** Igual que `dinero`, pero vacío → null. */
export const dineroOpcional = () =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : aCentavos(v)),
    z.number({ error: "Escribe un importe válido." }).int().min(0, { error: "No puede ser negativo." }).nullable(),
  );
