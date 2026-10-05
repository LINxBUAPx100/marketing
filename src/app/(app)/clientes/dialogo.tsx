"use client";

import { Pencil, UserPlus } from "lucide-react";
import { Campo, Selector } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoFormulario } from "@/lib/formulario";
import { REGIMENES_FISCALES, USOS_CFDI } from "@/lib/sat";
import { guardarCliente } from "./acciones";

export type ValoresCliente = {
  id: string;
  nombre: string;
  empresa: string;
  telefono: string;
  correo: string;
  tipoPrecio: "publico" | "revendedor";
  rfc: string;
  razonSocial: string;
  regimenFiscal: string;
  codigoPostal: string;
  usoCfdi: string;
  notas: string;
  activo: boolean;
};

type Props = {
  cliente?: ValoresCliente;
  /** Botón que abre el diálogo; por omisión, "Nuevo cliente". */
  disparador?: React.ReactElement;
  /** Nombre sugerido al crear desde el punto de venta. */
  nombreInicial?: string;
  alGuardar?: (resultado: NonNullable<EstadoFormulario>) => void;
};

export function DialogoCliente({ cliente, disparador, nombreInicial, alGuardar }: Props) {
  const editando = !!cliente;
  return (
    <DialogoFormulario
      titulo={editando ? `Editar a ${cliente.nombre}` : "Nuevo cliente"}
      accion={guardarCliente}
      alGuardar={alGuardar}
      ancho="sm:max-w-2xl"
      disparador={
        disparador ??
        (editando ? (
          <Button variant="outline">
            <Pencil /> Editar
          </Button>
        ) : (
          <Button>
            <UserPlus /> Nuevo cliente
          </Button>
        ))
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="id" value={cliente?.id ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre" nombre="nombre" defaultValue={cliente?.nombre ?? nombreInicial} required autoFocus errores={e.nombre} />
            <Campo etiqueta="Empresa" nombre="empresa" defaultValue={cliente?.empresa} errores={e.empresa} />
            <Campo etiqueta="WhatsApp o teléfono" nombre="telefono" type="tel" defaultValue={cliente?.telefono} errores={e.telefono} />
            <Campo etiqueta="Correo" nombre="correo" type="email" defaultValue={cliente?.correo} errores={e.correo} />
            <Selector etiqueta="Precios que se le cobran" nombre="tipoPrecio" defaultValue={cliente?.tipoPrecio ?? "publico"} errores={e.tipoPrecio}>
              <option value="publico">Precio al público</option>
              <option value="revendedor">Precio de revendedor</option>
            </Selector>
          </div>

          <details className="group rounded-lg border px-3 py-2" open={!!cliente?.rfc}>
            <summary className="cursor-pointer text-sm font-medium">Datos para facturar</summary>
            <div className="grid gap-4 pt-3 pb-1 sm:grid-cols-2">
              <Campo etiqueta="RFC" nombre="rfc" defaultValue={cliente?.rfc} maxLength={13} className="uppercase" errores={e.rfc} />
              <Campo etiqueta="Razón social" nombre="razonSocial" defaultValue={cliente?.razonSocial} errores={e.razonSocial} />
              <Selector etiqueta="Régimen fiscal" nombre="regimenFiscal" defaultValue={cliente?.regimenFiscal ?? ""} errores={e.regimenFiscal}>
                <option value="">Sin definir</option>
                {REGIMENES_FISCALES.map(([clave, nombre]) => (
                  <option key={clave} value={clave}>
                    {clave} · {nombre}
                  </option>
                ))}
              </Selector>
              <Campo etiqueta="Código postal fiscal" nombre="codigoPostal" inputMode="numeric" maxLength={5} defaultValue={cliente?.codigoPostal} errores={e.codigoPostal} />
              <Selector etiqueta="Uso de CFDI" nombre="usoCfdi" defaultValue={cliente?.usoCfdi ?? ""} errores={e.usoCfdi}>
                <option value="">Sin definir</option>
                {USOS_CFDI.map(([clave, nombre]) => (
                  <option key={clave} value={clave}>
                    {clave} · {nombre}
                  </option>
                ))}
              </Selector>
            </div>
          </details>

          <div className="grid gap-1.5">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" name="notas" defaultValue={cliente?.notas} rows={2} placeholder="Preferencias, forma de entrega…" />
          </div>
          {editando && (
            <label className="flex items-center gap-2 text-sm">
              {/* El oculto va primero: si la casilla está marcada, su valor lo reemplaza. */}
              <input type="hidden" name="activo" value="false" />
              <input type="checkbox" name="activo" value="true" defaultChecked={cliente.activo} className="accent-primary size-4" />
              Cliente activo
            </label>
          )}
        </>
      )}
    </DialogoFormulario>
  );
}
