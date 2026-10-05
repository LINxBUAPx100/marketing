"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Selector } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatoMoneda } from "@/lib/numeros";
import { mover } from "./acciones";

export type EtapaOpcion = { id: string; nombre: string; tipo: "proceso" | "listo" | "entregado"; responsableId: string | null };

const SIN_CAMBIO = "__etapa__";

export function DialogoMover({
  orden,
  etapas,
  usuarios,
  disparador,
}: {
  orden: { id: string; folio: string; etapaId: string; responsableId: string | null; saldo: number };
  etapas: EtapaOpcion[];
  usuarios: { id: string; nombre: string }[];
  disparador: React.ReactElement;
}) {
  const [abierto, setAbierto] = useState(false);
  const [etapaId, setEtapaId] = useState(orden.etapaId);
  // SIN_CAMBIO: al cambiar de etapa, toma el responsable de omisión de esa etapa.
  const [responsable, setResponsable] = useState<string>(orden.responsableId ?? "");
  const [nota, setNota] = useState("");
  const [guardando, iniciar] = useTransition();
  const etapa = etapas.find((e) => e.id === etapaId);
  const cambiaEtapa = etapaId !== orden.etapaId;

  function guardar() {
    iniciar(async () => {
      const r = await mover({
        ordenId: orden.id,
        etapaId,
        responsableId: responsable === SIN_CAMBIO ? undefined : responsable || null,
        nota: nota || null,
      });
      if (!r.ok) return void toast.error(r.mensaje);
      toast.success(cambiaEtapa ? `${orden.folio} → ${etapa?.nombre}` : "Orden actualizada.");
      setAbierto(false);
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(a) => {
        setAbierto(a);
        if (a) {
          setEtapaId(orden.etapaId);
          setResponsable(orden.responsableId ?? "");
          setNota("");
        }
      }}
    >
      <DialogTrigger render={disparador} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Orden {orden.folio}</DialogTitle>
          <DialogDescription>Cambia la etapa, el responsable o deja una nota en el historial.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Selector
            etiqueta="Etapa"
            nombre="etapa"
            value={etapaId}
            onChange={(e) => {
              setEtapaId(e.target.value);
              if (e.target.value !== orden.etapaId) setResponsable(SIN_CAMBIO);
            }}
          >
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Responsable" nombre="responsable" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
            {cambiaEtapa && <option value={SIN_CAMBIO}>El de la etapa {etapa?.responsableId ? `(${usuarios.find((u) => u.id === etapa.responsableId)?.nombre})` : "(nadie)"}</option>}
            <option value="">Sin responsable</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </Selector>
          <div className="grid gap-1.5">
            <Label htmlFor={`nota-${orden.id}`}>Nota</Label>
            <Textarea id={`nota-${orden.id}`} rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. falta aprobar el diseño con el cliente" />
          </div>
          {etapa?.tipo === "entregado" && orden.saldo > 0 && (
            <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
              Esta venta tiene saldo pendiente de {formatoMoneda(orden.saldo)}. Cóbralo antes de entregar.
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <Button type="button" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
