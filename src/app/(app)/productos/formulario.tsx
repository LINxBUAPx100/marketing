"use client";

import { ImageOff, ImageUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  requiereProduccion: boolean;
  tipoImpresion: string;
  impresionesPorUnidad: string;
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
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const nuevo = !valores.id;

  useEffect(() => {
    if (estado?.ok) toast.success(estado.mensaje);
  }, [estado]);

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={valores.id ?? ""} />
      <input type="hidden" name="quitarImagen" value={String(quitar)} />
      {!estado?.ok && <MensajeFormulario estado={estado} />}

      <fieldset disabled={!puedeEditar} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
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

          <Card>
            <CardHeader>
              <CardTitle>Impresiones</CardTitle>
              <CardDescription>Cuántas impresiones gasta una unidad. Sirve para detectar impresiones fantasma contra los contadores.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Selector etiqueta="Tipo de impresión" nombre="tipoImpresion" defaultValue={valores.tipoImpresion} errores={e.tipoImpresion}>
                <option value="">No se imprime</option>
                <option value="byn">Blanco y negro</option>
                <option value="color">Color</option>
                <option value="gran_formato">Gran formato (m²)</option>
              </Selector>
              <Campo
                etiqueta="Impresiones por unidad"
                nombre="impresionesPorUnidad"
                type="number"
                step="any"
                min="0"
                defaultValue={valores.impresionesPorUnidad}
                ayuda="Ej. 1 millar de volantes media carta = 250 hojas impresas"
                errores={e.impresionesPorUnidad}
              />
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

        {/* min-w-0: sin esto, el contenido de la columna puede ensanchar la página. */}
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Imagen</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {vista && !quitar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vista} alt="Vista previa" className="mx-auto aspect-square w-full max-w-56 rounded-lg border object-cover" />
              ) : (
                <div className="bg-muted text-muted-foreground mx-auto grid aspect-square w-full max-w-56 place-items-center rounded-lg">
                  <ImageOff className="size-8" />
                </div>
              )}
              {/* El input nativo queda oculto: su texto ("No se ha seleccionado…") no se puede acomodar. */}
              <input
                ref={archivoRef}
                id="imagen"
                type="file"
                name="imagen"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(ev) => {
                  const archivo = ev.target.files?.[0];
                  if (archivo) {
                    setVista(URL.createObjectURL(archivo));
                    setNombreArchivo(archivo.name);
                    setQuitar(false);
                  }
                }}
              />
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => archivoRef.current?.click()}>
                  <ImageUp /> {vista && !quitar ? "Cambiar imagen" : "Elegir imagen"}
                </Button>
                {vista && !quitar && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQuitar(true);
                      setNombreArchivo(null);
                      if (archivoRef.current) archivoRef.current.value = "";
                    }}
                  >
                    Quitar
                  </Button>
                )}
              </div>
              {nombreArchivo && <p className="text-muted-foreground truncate text-xs" title={nombreArchivo}>{nombreArchivo}</p>}
              {e.imagen && <p className="text-destructive text-sm">{e.imagen[0]}</p>}
              <p className="text-muted-foreground text-xs">JPG, PNG o WebP de hasta 3 MB.</p>
            </CardContent>
          </Card>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="activo" defaultChecked={valores.activo} className="accent-primary size-4" />
            Disponible para vender
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="requiereProduccion" defaultChecked={valores.requiereProduccion} className="accent-primary mt-0.5 size-4" />
            <span>
              Genera orden de producción
              <span className="text-muted-foreground block text-xs">Al venderlo, la venta se manda al taller.</span>
            </span>
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
