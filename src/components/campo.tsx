import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Input> & {
  etiqueta: string;
  nombre: string;
  errores?: string[];
  ayuda?: string;
};

/** Etiqueta + input + error, con los atributos de accesibilidad conectados. */
export function Campo({ etiqueta, nombre, errores, ayuda, className, ...props }: Props) {
  const idError = `${nombre}-error`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={nombre}>{etiqueta}</Label>
      <Input
        id={nombre}
        name={nombre}
        aria-invalid={errores?.length ? true : undefined}
        aria-describedby={errores?.length ? idError : undefined}
        {...props}
      />
      {errores?.length ? (
        <p id={idError} className="text-destructive text-sm">
          {errores[0]}
        </p>
      ) : ayuda ? (
        <p className="text-muted-foreground text-xs">{ayuda}</p>
      ) : null}
    </div>
  );
}

/** Mensaje general de un formulario (error o éxito). */
export function MensajeFormulario({ estado }: { estado?: { ok?: boolean; mensaje?: string } }) {
  if (!estado?.mensaje) return null;
  return (
    <p
      role={estado.ok ? "status" : "alert"}
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        estado.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive",
      )}
    >
      {estado.mensaje}
    </p>
  );
}

/** <select> nativo con el mismo estilo que los inputs. Funciona con FormData sin JS extra. */
export function Selector({
  etiqueta,
  nombre,
  errores,
  className,
  children,
  ...props
}: React.ComponentProps<"select"> & { etiqueta: string; nombre: string; errores?: string[] }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={nombre}>{etiqueta}</Label>
      <select
        id={nombre}
        name={nombre}
        aria-invalid={errores?.length ? true : undefined}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
        {...props}
      >
        {children}
      </select>
      {errores?.length ? <p className="text-destructive text-sm">{errores[0]}</p> : null}
    </div>
  );
}
