"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Selector } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { global } from "./acciones";

const PERIODOS = [
  ["day", "Diaria"],
  ["week", "Semanal"],
  ["fortnight", "Quincenal"],
  ["month", "Mensual"],
  ["two_months", "Bimestral"],
] as const;

export function DialogoGlobal({ hoy, sucursal }: { hoy: string; sucursal: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState(`${hoy.slice(0, 8)}01`);
  const [hasta, setHasta] = useState(hoy);
  const [periodicidad, setPeriodicidad] = useState<(typeof PERIODOS)[number][0]>("month");
  const [timbrando, iniciar] = useTransition();

  function timbrar() {
    iniciar(async () => {
      const r = await global({ desde, hasta, periodicidad });
      if (!r.ok) return void toast.error(r.mensaje);
      toast.success(`Factura global con ${r.ventas} ${r.ventas === 1 ? "venta" : "ventas"}.`);
      setAbierto(false);
      router.push(`/facturacion/${r.id}`);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Globe /> Factura global
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Factura global de {sucursal}</DialogTitle>
          <DialogDescription>Ampara las ventas cobradas del periodo que nadie pidió facturar (público en general, RFC XAXX010101000).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="global-desde">Desde</Label>
              <Input id="global-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="global-hasta">Hasta</Label>
              <Input id="global-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>
          <Selector etiqueta="Periodicidad" nombre="periodicidad" value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value as typeof periodicidad)}>
            {PERIODOS.map(([v, et]) => (
              <option key={v} value={v}>
                {et}
              </option>
            ))}
          </Selector>
          <p className="text-muted-foreground text-xs">Las ventas que se incluyan ya no podrán facturarse a nombre de un cliente.</p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <Button type="button" onClick={timbrar} disabled={timbrando}>
            {timbrando ? "Timbrando…" : "Timbrar global"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
