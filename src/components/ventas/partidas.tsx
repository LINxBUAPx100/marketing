"use client";

// Piezas compartidas por el punto de venta y el editor de cotizaciones:
// catálogo de productos, lista de partidas editable y totales.

import { ImageOff, MessageSquareText, PenLine, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { aCentavos, centavosATexto, formatoCantidad, formatoMoneda } from "@/lib/numeros";
import { cn } from "@/lib/utils";
import { calcularTotales, importePartida, validarPartida, type ConfigIva, type Totales } from "@/lib/ventas/calculo";

export type ProductoCatalogo = {
  id: string;
  nombre: string;
  codigo: string | null;
  tipo: "producto" | "servicio";
  unidad: string;
  precio: number;
  precioRevendedor: number | null;
  imagen: string | null;
  categoriaId: string | null;
  existencia: number | null;
  requiereProduccion: boolean;
};

export type Linea = {
  clave: number;
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidad: string;
  /** Texto en pesos si se cambió a mano; null = precio de lista del cliente. */
  precio: string | null;
  descuento: string;
  notas: string;
  verNotas: boolean;
};

/** Partida guardada (de una cotización) para precargar el editor. */
export type PartidaInicial = {
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  notas: string | null;
};

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const aNumero = (s: string) => Number(s.replace(",", "."));
let siguienteClave = 1;

export const lineaDesde = (p: PartidaInicial): Linea => ({
  clave: siguienteClave++,
  productoId: p.productoId,
  descripcion: p.descripcion,
  unidad: p.unidad,
  cantidad: String(p.cantidad),
  precio: centavosATexto(p.precioUnitario),
  descuento: p.descuento ? centavosATexto(p.descuento) : "",
  notas: p.notas ?? "",
  verNotas: false,
});

export function usePartidas({
  productos,
  tipoPrecio,
  iva,
  iniciales = [],
}: {
  productos: ProductoCatalogo[];
  tipoPrecio: "publico" | "revendedor" | undefined;
  iva: ConfigIva;
  iniciales?: PartidaInicial[];
}) {
  const [lineas, setLineas] = useState<Linea[]>(() => iniciales.map(lineaDesde));
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const precioLista = (p: ProductoCatalogo) => (tipoPrecio === "revendedor" && p.precioRevendedor != null ? p.precioRevendedor : p.precio);

  // Cada línea convertida a números, con su error si lo tiene.
  const calculadas = lineas.map((l) => {
    const producto = l.productoId ? porId.get(l.productoId) : undefined;
    const precioUnitario = l.precio != null ? aCentavos(l.precio) : producto ? precioLista(producto) : 0;
    const partida = { cantidad: aNumero(l.cantidad), precioUnitario, descuento: l.descuento.trim() ? aCentavos(l.descuento) : 0 };
    const error =
      Number.isNaN(partida.cantidad) || Number.isNaN(partida.precioUnitario) || Number.isNaN(partida.descuento)
        ? "Revisa los números."
        : !l.productoId && !l.descripcion.trim()
          ? "Escribe qué se vende."
          : validarPartida(partida);
    return { linea: l, producto, partida, error };
  });
  const totales = calcularTotales(
    calculadas.filter((c) => !c.error).map((c) => c.partida),
    iva,
  );

  function agregar(p: ProductoCatalogo) {
    setLineas((actuales) => {
      const igual = actuales.find((l) => l.productoId === p.id && l.precio == null && !l.descuento && !l.notas);
      if (igual) return actuales.map((l) => (l === igual ? { ...l, cantidad: String(aNumero(l.cantidad) + 1) } : l));
      return [...actuales, { clave: siguienteClave++, productoId: p.id, descripcion: p.nombre, unidad: p.unidad, cantidad: "1", precio: null, descuento: "", notas: "", verNotas: false }];
    });
  }

  const agregarLibre = () =>
    setLineas((actuales) => [
      ...actuales,
      { clave: siguienteClave++, productoId: null, descripcion: "", unidad: "servicio", cantidad: "1", precio: "", descuento: "", notas: "", verNotas: false },
    ]);

  const cambiar = (clave: number, cambios: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));
  const quitar = (clave: number) => setLineas((ls) => ls.filter((l) => l.clave !== clave));

  /** Partidas listas para el servidor (centavos y números). */
  const paraEnviar = () =>
    calculadas.map(({ linea, partida }) => ({
      productoId: linea.productoId,
      descripcion: linea.descripcion,
      cantidad: partida.cantidad,
      precioUnitario: partida.precioUnitario,
      descuento: partida.descuento,
      notas: linea.notas || null,
    }));

  // Va al taller si algún producto lo requiere o hay un concepto libre (trabajo a la medida).
  const sugiereProduccion = calculadas.some((c) => (c.producto ? c.producto.requiereProduccion : !c.linea.productoId));

  return {
    lineas,
    calculadas,
    totales,
    hayErrores: calculadas.some((c) => c.error),
    sugiereProduccion,
    precioLista,
    agregar,
    agregarLibre,
    cambiar,
    quitar,
    paraEnviar,
  };
}

export type Partidas = ReturnType<typeof usePartidas>;

export function Catalogo({
  productos,
  categorias,
  precioLista,
  onAgregar,
  onLibre,
}: {
  productos: ProductoCatalogo[];
  categorias: { id: string; nombre: string }[];
  precioLista: (p: ProductoCatalogo) => number;
  onAgregar: (p: ProductoCatalogo) => void;
  onLibre: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return productos.filter(
      (p) => (!categoria || p.categoriaId === categoria) && (!q || normalizar(p.nombre).includes(q) || normalizar(p.codigo ?? "").includes(q)),
    );
  }, [productos, busqueda, categoria]);

  return (
    <div className="grid min-w-0 gap-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && visibles[0]) {
              e.preventDefault();
              onAgregar(visibles[0]);
              setBusqueda("");
            }
          }}
          placeholder="Buscar producto o código · Enter agrega el primero"
          aria-label="Buscar producto"
          className="h-10 pl-9"
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Categorías">
        <Chip activo={!categoria} onClick={() => setCategoria(null)}>
          Todos
        </Chip>
        {categorias.map((c) => (
          <Chip key={c.id} activo={categoria === c.id} onClick={() => setCategoria(c.id)}>
            {c.nombre}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2.5">
        <button
          type="button"
          onClick={onLibre}
          className="text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring/50 grid min-h-36 place-content-center justify-items-center gap-1.5 rounded-xl border border-dashed p-3 text-center text-sm outline-none focus-visible:ring-3"
        >
          <PenLine className="size-5" />
          Concepto libre
          <span className="text-xs">Diseño, trabajo especial…</span>
        </button>
        {visibles.map((p) => {
          const agotado = p.tipo === "producto" && (p.existencia ?? 0) <= 0;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onAgregar(p)}
              className="bg-card hover:border-primary focus-visible:ring-ring/50 grid content-start gap-1.5 rounded-xl border p-2 text-left outline-none focus-visible:ring-3"
            >
              {p.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagen} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
              ) : (
                <span className="bg-muted text-muted-foreground grid aspect-[4/3] w-full place-items-center rounded-lg">
                  <ImageOff className="size-5" />
                </span>
              )}
              <span className="line-clamp-2 text-sm leading-snug font-medium">{p.nombre}</span>
              <span className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold tabular-nums">{formatoMoneda(precioLista(p))}</span>
                {p.tipo === "producto" && (
                  <span className={cn("text-xs tabular-nums", agotado ? "text-destructive font-medium" : "text-muted-foreground")}>
                    {formatoCantidad(p.existencia ?? 0)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {visibles.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {productos.length ? "Ningún producto coincide." : "Aún no hay productos. Usa «Concepto libre» o da de alta productos."}
        </p>
      )}
    </div>
  );
}

export function ListaPartidas({ partidas, puedeDescontar }: { partidas: Partidas; puedeDescontar: boolean }) {
  const { calculadas, cambiar, quitar } = partidas;
  return (
    <ol className="grid gap-2" aria-label="Partidas">
      {calculadas.length === 0 && (
        <li className="text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm">Toca un producto para agregarlo.</li>
      )}
      {calculadas.map(({ linea: l, producto, partida, error }) => (
        <li key={l.clave} className={cn("grid gap-2 rounded-lg border p-2.5", error && "border-destructive/60")}>
          <div className="flex items-start gap-2">
            {l.productoId ? (
              <p className="min-w-0 flex-1 text-sm leading-snug font-medium">{l.descripcion}</p>
            ) : (
              <Input
                value={l.descripcion}
                autoFocus={!l.descripcion}
                placeholder="¿Qué se vende?"
                aria-label="Descripción del concepto"
                onChange={(e) => cambiar(l.clave, { descripcion: e.target.value })}
                className="h-7 flex-1"
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Agregar notas a la partida"
              aria-pressed={l.verNotas}
              onClick={() => cambiar(l.clave, { verNotas: !l.verNotas })}
            >
              <MessageSquareText />
            </Button>
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar partida" onClick={() => quitar(l.clave)}>
              <Trash2 />
            </Button>
          </div>
          <div className={cn("grid gap-2", puedeDescontar ? "grid-cols-3" : "grid-cols-2")}>
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Cantidad ({l.unidad})</span>
              <Input inputMode="decimal" value={l.cantidad} onChange={(e) => cambiar(l.clave, { cantidad: e.target.value })} className="h-7 tabular-nums" />
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Precio unitario</span>
              <Input
                inputMode="decimal"
                value={l.precio ?? centavosATexto(partida.precioUnitario)}
                // Los productos de catálogo solo cambian de precio con permiso de descuento.
                readOnly={!!producto && !puedeDescontar}
                onChange={(e) => cambiar(l.clave, { precio: e.target.value })}
                className="h-7 tabular-nums read-only:bg-muted/50"
              />
            </label>
            {puedeDescontar && (
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">Descuento $</span>
                <Input inputMode="decimal" value={l.descuento} placeholder="0.00" onChange={(e) => cambiar(l.clave, { descuento: e.target.value })} className="h-7 tabular-nums" />
              </label>
            )}
          </div>
          {l.verNotas && (
            <Textarea
              value={l.notas}
              rows={2}
              autoFocus
              placeholder="Especificaciones: tamaño, papel, tintas, acabado…"
              aria-label="Notas de la partida"
              onChange={(e) => cambiar(l.clave, { notas: e.target.value })}
            />
          )}
          {!l.verNotas && l.notas && <p className="text-muted-foreground text-xs whitespace-pre-line">{l.notas}</p>}
          <div className="flex items-center justify-between text-sm">
            {error ? <span className="text-destructive text-xs">{error}</span> : <span />}
            <span className="font-semibold tabular-nums">{error ? "—" : formatoMoneda(importePartida(partida))}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ResumenTotales({ totales, ivaBp }: { totales: Totales; ivaBp: number }) {
  return (
    <dl className="grid gap-1 border-t pt-3 text-sm">
      {totales.descuento > 0 && (
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Descuentos</dt>
          <dd className="tabular-nums">−{formatoMoneda(totales.descuento)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="tabular-nums">{formatoMoneda(totales.subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">IVA {ivaBp / 100}%</dt>
        <dd className="tabular-nums">{formatoMoneda(totales.iva)}</dd>
      </div>
      <div className="flex justify-between text-lg font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatoMoneda(totales.total)}</dd>
      </div>
    </dl>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap outline-none focus-visible:ring-3",
        activo ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
