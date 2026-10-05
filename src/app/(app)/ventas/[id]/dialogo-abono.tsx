"use client";

import { HandCoins } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EditorPagos, nuevoPago, pagosParaEnviar, resumenPagos, type PagoEditable } from "@/components/ventas/editor-pagos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatoMoneda } from "@/lib/numeros";
import { abonar } from "../acciones";

export function DialogoAbono({ ventaId, saldo }: { ventaId: string; saldo: number }) {
  const [abierto, setAbierto] = useState(false);
  const [pagos, setPagos] = useState<PagoEditable[]>([]);
  const [enviando, iniciar] = useTransition();
  const router = useRouter();
  const r = resumenPagos(pagos, saldo);

  function guardar() {
    const enviables = pagosParaEnviar(pagos);
    if (!enviables.length) return toast.error("Agrega el pago.");
    if (r.invalido || r.excedido) return toast.error(r.excedido ? "El pago es mayor al saldo." : "Revisa los importes.");
    iniciar(async () => {
      const resultado = await abonar(ventaId, enviables);
      if (!resultado.ok) return void toast.error(resultado.mensaje);
      toast.success(`Pago de ${formatoMoneda(r.pagado)} registrado.`);
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(a) => {
        setAbierto(a);
        if (a) setPagos([nuevoPago("efectivo", saldo)]);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <HandCoins /> Registrar pago
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>Saldo pendiente: {formatoMoneda(saldo)}. Puedes abonar una parte.</DialogDescription>
        </DialogHeader>
        <EditorPagos pagos={pagos} onChange={setPagos} porCobrar={saldo} />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <Button type="button" onClick={guardar} disabled={enviando}>
            {enviando ? "Guardando…" : "Registrar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
