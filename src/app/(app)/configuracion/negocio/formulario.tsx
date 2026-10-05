"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Campo, MensajeFormulario, Selector } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { useFormulario } from "@/hooks/use-formulario";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { REGIMENES_FISCALES } from "@/lib/sat";
import { guardarNegocio } from "../acciones";


type Valores = {
  nombre: string;
  razonSocial: string;
  rfc: string;
  regimenFiscal: string;
  codigoPostal: string;
  direccion: string;
  telefono: string;
  correo: string;
  iva: string;
  preciosIncluyenIva: boolean;
};

export function FormularioNegocio({ valores, puedeEditar }: { valores: Valores; puedeEditar: boolean }) {
  const { estado, onSubmit, enviando, errores: e } = useFormulario(guardarNegocio);

  useEffect(() => {
    if (estado?.ok) toast.success(estado.mensaje);
  }, [estado]);

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <fieldset disabled={!puedeEditar} className="grid gap-6">
        {!estado?.ok && <MensajeFormulario estado={estado} />}
        <Card>
          <CardHeader>
            <CardTitle>Datos generales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre comercial" nombre="nombre" defaultValue={valores.nombre} required errores={e.nombre} />
            <Campo etiqueta="Teléfono" nombre="telefono" type="tel" defaultValue={valores.telefono} errores={e.telefono} />
            <Campo etiqueta="Correo" nombre="correo" type="email" defaultValue={valores.correo} errores={e.correo} />
            <Campo etiqueta="Dirección" nombre="direccion" defaultValue={valores.direccion} errores={e.direccion} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos fiscales</CardTitle>
            <CardDescription>Tal como aparecen en la Constancia de Situación Fiscal.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Razón social" nombre="razonSocial" defaultValue={valores.razonSocial} errores={e.razonSocial} />
            <Campo etiqueta="RFC" nombre="rfc" defaultValue={valores.rfc} className="uppercase" maxLength={13} errores={e.rfc} />
            <Selector etiqueta="Régimen fiscal" nombre="regimenFiscal" defaultValue={valores.regimenFiscal} errores={e.regimenFiscal}>
              <option value="">Sin definir</option>
              {REGIMENES_FISCALES.map(([clave, nombre]) => (
                <option key={clave} value={clave}>
                  {clave} · {nombre}
                </option>
              ))}
            </Selector>
            <Campo etiqueta="Código postal fiscal" nombre="codigoPostal" inputMode="numeric" maxLength={5} defaultValue={valores.codigoPostal} errores={e.codigoPostal} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impuestos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="IVA (%)" nombre="iva" type="number" step="0.01" min="0" max="100" defaultValue={valores.iva} errores={e.iva} />
            <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
              <input type="checkbox" name="preciosIncluyenIva" defaultChecked={valores.preciosIncluyenIva} className="accent-primary size-4" />
              Los precios de venta ya incluyen IVA
            </label>
          </CardContent>
        </Card>
      </fieldset>

      {puedeEditar ? (
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Solo puedes consultar estos datos.</p>
      )}
    </form>
  );
}
