"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MensajeFormulario } from "@/components/campo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFormulario } from "@/hooks/use-formulario";
import type { EstadoFormulario } from "@/lib/formulario";

type Accion = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

type Props = {
  titulo: string;
  descripcion?: string;
  /** Elemento que abre el diálogo, por ejemplo un <Button>. */
  disparador: React.ReactElement;
  accion: Accion;
  textoGuardar?: string;
  /** Recibe los errores por campo para pintarlos junto a cada input. */
  children: (errores: Record<string, string[] | undefined>) => React.ReactNode;
  ancho?: string;
  /** Se llama después de guardar con éxito, con lo que regresó la acción. */
  alGuardar?: (resultado: NonNullable<EstadoFormulario>) => void;
};

/** Diálogo con formulario: se cierra y avisa al guardar con éxito; muestra errores si no. */
export function DialogoFormulario({ titulo, descripcion, disparador, accion, textoGuardar = "Guardar", children, ancho = "sm:max-w-lg", alGuardar }: Props) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={disparador} />
      <DialogContent className={ancho}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion ? <DialogDescription>{descripcion}</DialogDescription> : null}
        </DialogHeader>
        {/* Se monta solo con el diálogo abierto: cada apertura empieza sin errores previos. */}
        <Formulario accion={accion} textoGuardar={textoGuardar} alGuardar={(r) => {
            setAbierto(false);
            alGuardar?.(r);
          }}
        >
          {children}
        </Formulario>
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  accion,
  textoGuardar,
  alGuardar,
  children,
}: Pick<Props, "accion" | "textoGuardar" | "children"> & { alGuardar: (r: NonNullable<EstadoFormulario>) => void }) {
  const { estado, onSubmit, enviando, errores } = useFormulario(async (previo, formData) => {
    const resultado = await accion(previo, formData);
    if (resultado?.ok) {
      toast.success(resultado.mensaje ?? "Guardado.");
      alGuardar(resultado);
    }
    return resultado;
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <MensajeFormulario estado={estado?.ok ? undefined : estado} />
      <div className="grid max-h-[65svh] gap-4 overflow-y-auto px-0.5">{children(errores)}</div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : textoGuardar}
        </Button>
      </DialogFooter>
    </form>
  );
}
