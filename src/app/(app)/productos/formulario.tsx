"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Campo, MensajeFormulario, Selector } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormulario } from "@/hooks/use-formulario";
import { guardarProducto } from "./acciones";

const UNIDADES = ["pieza", "millar", "ciento", "juego", "hoja", "m²", "metro lineal", "rollo", "paquete", "caja", "servicio"];

export type ValoresProducto = {
  id?: string;
  nombre: string;
  codigo: string;
  categoriaId: string;
  descripcion: string;
  tipo: "producto" | "servicio";
  unidad: string;
  precio: string;
  precioRevendedor: string;
  costo: string;
  existenciaMinima: string;
  activo: boolean;
  imagenUrl: string | null;
};

type Props = {
  valores: ValoresProducto;
  categorias: { id: string; nombre: string }[];
  verCostos: boolean;
  puedeEditar: boolean;
  sucursal: string | null;
};

export function FormularioProducto({ valores, categorias, verCostos, puedeEditar, sucursal }: Props) {
  const { estado, onSubmit, enviando, errores: e } = useFormulario(guardarProducto);
  const [tipo, setTipo] = useState(valores.tipo);
  const [vista, setVista] = useState<string | null>(valores.imagenUrl);
  const [quitar, setQuitar] = useState(false);
  const nuevo = !valores.id;

  useEffect(() => {
    if (estado?.ok) toast.success(estado.mensaje);
  }, [estado]);

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={valores.id ?? ""} />
      <input type="hidden" name="quitarImagen" value={String(quitar)} />
      {!estado?.ok && <MensajeFormulario estado={estado} />}

      <fieldset disabled={!puedeEditar} className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos generales</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre" nombre="nombre" defaultValue={valores.nombre} required className="sm:col-span-2" errores={e.nombre} />
              <Campo etiqueta="Código o SKU" nombre="codigo" defaultValue={valores.codigo} errores={e.codigo} />
              <Selector etiqueta="Categoría" nombre="categoriaId" defaultValue={valores.categoriaId} errores={e.categoriaId}>
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
              <Selector etiqueta="Tipo" nombre="tipo" value={tipo} onChange={(ev) => setTipo(ev.target.value as typeof tipo)} errores={e.tipo}>
                <option value="producto">Producto (lleva existencias)</option>
                <option value="servicio">Servicio (sin existencias)</option>
              </Selector>
              <Campo etiqueta="Se vende por" nombre="unidad" defaultValue={valores.unidad} list="unidades" required errores={e.unidad} />
              <datalist id="unidades">
                {UNIDADES.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea id="descripcion" name="descripcion" defaultValue={valores.descripcion} rows={3} placeholder="Medidas, papel, acabados…" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Precios</CardTitle>
              <CardDescription>En pesos. Al cliente revendedor se le cobra su precio cuando existe.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Precio al público" nombre="precio" inputMode="decimal" defaultValue={valores.precio} required errores={e.precio} />
              <Campo etiqueta="Precio revendedor" nombre="precioRevendedor" inputMode="decimal" defaultValue={valores.precioRevendedor} errores={e.precioRevendedor} ayuda="Opcional" />
              {verCostos && (
                <Campo etiqueta="Costo" nombre="costo" inputMode="decimal" defaultValue={valores.costo} errores={e.costo} ayuda="Solo lo ven quienes tienen permiso" />
              )}
            </CardContent>
          </Card>

          {tipo === "producto" && (
            <Card>
              <CardHeader>
                <CardTitle>Existencias</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Campo
                  etiqueta="Avisar cuando queden"
                  nombre="existenciaMinima"
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={valores.existenciaMinima}
                  errores={e.existenciaMinima}
                />
                {nuevo && (
                  <Campo
                    etiqueta={`Existencia inicial${sucursal ? ` en ${sucursal}` : ""}`}
                    nombre="existenciaInicial"
                    type="number"
                    step="any"
                    defaultValue="0"
                    errores={e.existenciaInicial}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Imagen</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {vista && !quitar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vista} alt="Vista previa" className="aspect-square w-full rounded-lg border object-cover" />
              ) : (
                <div className="bg-muted text-muted-foreground grid aspect-square w-full place-items-center rounded-lg">
                  <ImageOff className="size-8" />
                </div>
              )}
              <input
                type="file"
                name="imagen"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Subir imagen"
                className="file:bg-secondary file:text-secondary-foreground text-muted-foreground text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium"
                onChange={(ev) => {
                  const archivo = ev.target.files?.[0];
                  if (archivo) {
                    setVista(URL.createObjectURL(archivo));
                    setQuitar(false);
                  }
                }}
              />
              {e.imagen && <p className="text-destructive text-sm">{e.imagen[0]}</p>}
              {vista && !quitar && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setQuitar(true)}>
                  Quitar imagen
                </Button>
              )}
              <p className="text-muted-foreground text-xs">JPG, PNG o WebP de hasta 3 MB.</p>
            </CardContent>
          </Card>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="activo" defaultChecked={valores.activo} className="accent-primary size-4" />
            Disponible para vender
          </label>
        </div>
      </fieldset>

      {puedeEditar && (
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={enviando}>
            {enviando ? "Guardando…" : nuevo ? "Crear producto" : "Guardar cambios"}
          </Button>
        </div>
      )}
    </form>
  );
}
