"use client";

import { FileCheck2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { facturar } from "@/app/(app)/facturacion/acciones";
import { Selector } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ETIQUETA_FORMA_PAGO } from "@/lib/facturacion/reglas";
import { formatoMoneda } from "@/lib/numeros";
import { USOS_CFDI } from "@/lib/sat";

export type DatosFacturar = {
  ventaIds: string[];
  total: number;
  metodoPago: "PUE" | "PPD";
  formaPago: string;
  cliente: { id: string; nombre: string; rfc: string | null; razonSocial: string | null; usoCfdi: string | null; correo: string | null };
  errores: string[];
  simulado: boolean;
};

export function DialogoFacturar({ datos, disparador }: { datos: DatosFacturar; disparador?: React.ReactElement }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [uso, setUso] = useState(datos.cliente.usoCfdi ?? "G03");
  const [correo, setCorreo] = useState(datos.cliente.correo ?? "");
  const [timbrando, iniciar] = useTransition();
  const faltan = datos.errores.length > 0;

  function timbrar() {
    iniciar(async () => {
      const r = await facturar({ ventaIds: datos.ventaIds, usoCfdi: uso, correo: correo || null });
      if (!r.ok) return void toast.error(r.mensaje);
      toast.success(datos.simulado ? "Factura simulada creada (sin validez fiscal)." : "Factura timbrada.");
      setAbierto(false);
      router.push(`/facturacion/${r.id}`);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          disparador ?? (
            <Button variant="outline">
              <FileCheck2 /> Facturar
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Facturar a {datos.cliente.nombre}</DialogTitle>
          <DialogDescription>
            {datos.ventaIds.length === 1 ? "Una venta" : `${datos.ventaIds.length} ventas`} por {formatoMoneda(datos.total)}.
          </DialogDescription>
        </DialogHeader>

        {faltan ? (
          <div className="bg-destructive/5 border-destructive/40 grid gap-2 rounded-lg border px-3 py-3 text-sm">
            <p className="font-medium">Al cliente le falta para facturar:</p>
            <ul className="list-disc pl-5">
              {datos.errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            <Link href={`/clientes/${datos.cliente.id}`} className="text-primary font-medium hover:underline">
              Completar datos del cliente
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            <dl className="bg-muted/40 grid gap-1 rounded-lg px-3 py-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">RFC</dt>
                <dd className="font-mono">{datos.cliente.rfc}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Razón social</dt>
                <dd className="text-right">{datos.cliente.razonSocial}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Método</dt>
                <dd>{datos.metodoPago === "PUE" ? "PUE · pagada en una exhibición" : "PPD · en parcialidades (llevará complementos)"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Forma de pago</dt>
                <dd>{ETIQUETA_FORMA_PAGO[datos.formaPago] ?? datos.formaPago}</dd>
              </div>
            </dl>
            <Selector etiqueta="Uso de CFDI" nombre="uso" value={uso} onChange={(e) => setUso(e.target.value)}>
              {USOS_CFDI.filter(([c]) => c !== "CP01").map(([clave, nombre]) => (
                <option key={clave} value={clave}>
                  {clave} · {nombre}
                </option>
              ))}
            </Selector>
            <div className="grid gap-1.5">
              <Label htmlFor="correo-factura">Correo para enviarla</Label>
              <Input id="correo-factura" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Opcional" />
            </div>
            {datos.simulado && (
              <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                Modo simulación: no hay PAC configurado. La factura se crea para probar, pero NO se timbra ante el SAT ni tiene validez fiscal.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cerrar</DialogClose>
          {!faltan && (
            <Button type="button" onClick={timbrar} disabled={timbrando}>
              {timbrando ? "Timbrando…" : datos.simulado ? "Crear factura simulada" : "Timbrar factura"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
