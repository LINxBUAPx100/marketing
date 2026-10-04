"use client";

import { Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { costoUnitarioATexto, formatoCantidad, formatoMoneda } from "@/lib/numeros";

export type Articulo = { tipo: "insumo" | "producto"; id: string; nombre: string; unidad: string; costo: number; existencia: number };
export type LineaArticulo = { clave: string; tipo: "insumo" | "producto"; id: string; cantidad: string; costo: string };

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const aNumero = (s: string) => Number(s.replace(/[$,\s]/g, "").replace(",", "."));

/** Buscador de insumos y productos con existencias, más la lista de renglones elegidos. */
export function SelectorArticulos({
  articulos,
  lineas,
  onChange,
  conCosto,
  etiquetaExistencia = "Hay",
}: {
  articulos: Articulo[];
  lineas: LineaArticulo[];
  onChange: (lineas: LineaArticulo[]) => void;
  /** Compras capturan costo unitario; traspasos no. */
  conCosto: boolean;
  etiquetaExistencia?: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const porClave = useMemo(() => new Map(articulos.map((a) => [`${a.tipo}:${a.id}`, a])), [articulos]);
  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return [];
    return articulos.filter((a) => normalizar(a.nombre).includes(q) && !lineas.some((l) => l.clave === `${a.tipo}:${a.id}`)).slice(0, 8);
  }, [articulos, busqueda, lineas]);

  const agregar = (a: Articulo) => {
    onChange([...lineas, { clave: `${a.tipo}:${a.id}`, tipo: a.tipo, id: a.id, cantidad: "1", costo: costoUnitarioATexto(a.costo) }]);
    setBusqueda("");
  };
  const cambiar = (clave: string, cambios: Partial<LineaArticulo>) => onChange(lineas.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && resultados[0]) {
              e.preventDefault();
              agregar(resultados[0]);
            }
          }}
          placeholder="Buscar insumo o producto · Enter agrega el primero"
          aria-label="Buscar artículo"
          className="h-9 pl-8"
        />
        {resultados.length > 0 && (
          <ul className="bg-popover absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border p-1 shadow-lg" role="listbox">
            {resultados.map((a) => (
              <li key={`${a.tipo}:${a.id}`} role="option" aria-selected={false}>
                <button type="button" onClick={() => agregar(a)} className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm">
                  <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                  <Badge variant="outline">{a.tipo === "insumo" ? "Insumo" : "Producto"}</Badge>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {etiquetaExistencia} {formatoCantidad(a.existencia)} {a.unidad}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lineas.length === 0 && <p className="text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm">Busca y agrega los artículos.</p>}
      <ul className="grid gap-2">
        {lineas.map((l) => {
          const a = porClave.get(l.clave);
          const cantidad = aNumero(l.cantidad);
          const costo = aNumero(l.costo);
          const importe = Math.round(cantidad * costo * 100);
          const cantidadMala = !(cantidad > 0);
          const costoMalo = conCosto && !(costo >= 0);
          return (
            <li key={l.clave} className={`grid gap-2 rounded-lg border p-2.5 ${cantidadMala || costoMalo ? "border-destructive/60" : ""}`}>
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a?.nombre ?? "Artículo eliminado"}</span>
                  <span className="text-muted-foreground text-xs">
                    {a?.tipo === "insumo" ? "Insumo" : "Producto"} · {etiquetaExistencia} {formatoCantidad(a?.existencia ?? 0)} {a?.unidad}
                  </span>
                </span>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar" onClick={() => onChange(lineas.filter((x) => x.clave !== l.clave))}>
                  <Trash2 />
                </Button>
              </div>
              <div className={`grid gap-2 ${conCosto ? "grid-cols-3" : "grid-cols-2"}`}>
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">Cantidad ({a?.unidad})</span>
                  <Input inputMode="decimal" value={l.cantidad} onChange={(e) => cambiar(l.clave, { cantidad: e.target.value })} aria-invalid={cantidadMala || undefined} className="h-7 tabular-nums" />
                </label>
                {conCosto && (
                  <>
                    <label className="grid gap-1 text-xs">
                      <span className="text-muted-foreground">Costo unitario $</span>
                      <Input inputMode="decimal" value={l.costo} onChange={(e) => cambiar(l.clave, { costo: e.target.value })} aria-invalid={costoMalo || undefined} className="h-7 tabular-nums" />
                    </label>
                    <span className="grid gap-1 text-xs">
                      <span className="text-muted-foreground">Importe</span>
                      <span className="flex h-7 items-center justify-end text-sm font-semibold tabular-nums">{Number.isFinite(importe) ? formatoMoneda(importe) : "—"}</span>
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
