"use client";

import { ImageOff, MessageSquareText, PenLine, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { EditorPagos, nuevoPago, pagosParaEnviar, resumenPagos, type PagoEditable } from "@/components/ventas/editor-pagos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aCentavos, centavosATexto, formatoCantidad, formatoMoneda } from "@/lib/numeros";
import { cn } from "@/lib/utils";
import { calcularTotales, importePartida, validarPartida, type ConfigIva } from "@/lib/ventas/calculo";
import { registrarVenta } from "../acciones";
import { SelectorCliente, type ClienteVenta } from "./selector-cliente";

type Producto = {
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
};

type Linea = {
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

type Props = {
  sucursal: string;
  productos: Producto[];
  categorias: { id: string; nombre: string }[];
  clienteInicial: ClienteVenta | null;
  iva: ConfigIva;
  puedeDescontar: boolean;
  puedeCrearCliente: boolean;
};

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const aNumero = (s: string) => Number(s.replace(",", "."));
let siguienteClave = 1;

export function PuntoDeVenta({ sucursal, productos, categorias, clienteInicial, iva, puedeDescontar, puedeCrearCliente }: Props) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [cliente, setCliente] = useState<ClienteVenta | null>(clienteInicial);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [pagos, setPagos] = useState<PagoEditable[]>([]);
  const [entrega, setEntrega] = useState("");
  const [notas, setNotas] = useState("");
  const buscador = useRef<HTMLInputElement>(null);

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const precioLista = (p: Producto) => (cliente?.tipoPrecio === "revendedor" && p.precioRevendedor != null ? p.precioRevendedor : p.precio);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return productos.filter(
      (p) => (!categoria || p.categoriaId === categoria) && (!q || normalizar(p.nombre).includes(q) || normalizar(p.codigo ?? "").includes(q)),
    );
  }, [productos, busqueda, categoria]);

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
  const validas = calculadas.filter((c) => !c.error).map((c) => c.partida);
  const totales = calcularTotales(validas, iva);
  const pagosResumen = resumenPagos(pagos, totales.total);
  const hayErrores = calculadas.some((c) => c.error) || pagosResumen.invalido || pagosResumen.excedido;
  const faltaCliente = pagosResumen.saldo > 0 && !cliente;

  function agregar(p: Producto) {
    setLineas((actuales) => {
      const igual = actuales.find((l) => l.productoId === p.id && l.precio == null && !l.descuento && !l.notas);
      if (igual) {
        return actuales.map((l) => (l === igual ? { ...l, cantidad: String(aNumero(l.cantidad) + 1) } : l));
      }
      return [
        ...actuales,
        { clave: siguienteClave++, productoId: p.id, descripcion: p.nombre, unidad: p.unidad, cantidad: "1", precio: null, descuento: "", notas: "", verNotas: false },
      ];
    });
  }

  function agregarLibre() {
    setLineas((actuales) => [
      ...actuales,
      { clave: siguienteClave++, productoId: null, descripcion: "", unidad: "servicio", cantidad: "1", precio: "", descuento: "", notas: "", verNotas: false },
    ]);
  }

  const cambiar = (clave: number, cambios: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));

  function registrar() {
    if (!lineas.length) return toast.error("Agrega al menos un producto.");
    if (hayErrores) return toast.error("Corrige lo que está marcado en rojo.");
    if (faltaCliente) return toast.error("Para dejar saldo pendiente, elige el cliente.");

    iniciar(async () => {
      const resultado = await registrarVenta({
        clienteId: cliente?.id ?? null,
        fechaEntrega: entrega || null,
        notas: notas || null,
        partidas: calculadas.map(({ linea, partida }) => ({
          productoId: linea.productoId,
          descripcion: linea.descripcion,
          cantidad: partida.cantidad,
          precioUnitario: partida.precioUnitario,
          descuento: partida.descuento,
          notas: linea.notas || null,
        })),
        pagos: pagosParaEnviar(pagos),
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(`Venta ${resultado.folio} registrada.`);
      router.push(`/ventas/${resultado.id}`);
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
      {/* Catálogo */}
      <section className="grid min-w-0 gap-3" aria-label="Catálogo">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Nueva venta</h1>
          <span className="text-muted-foreground text-sm">{sucursal}</span>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            ref={buscador}
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && visibles[0]) {
                e.preventDefault();
                agregar(visibles[0]);
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
            onClick={agregarLibre}
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
                onClick={() => agregar(p)}
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
      </section>

      {/* Ticket */}
      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Venta</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SelectorCliente cliente={cliente} onChange={setCliente} puedeCrear={puedeCrearCliente} />

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
                      autoFocus
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
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar partida" onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}>
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
              <dt className="text-muted-foreground">IVA {iva.ivaBp / 100}%</dt>
              <dd className="tabular-nums">{formatoMoneda(totales.iva)}</dd>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatoMoneda(totales.total)}</dd>
            </div>
          </dl>

          <div className="grid gap-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cobro</span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0" disabled={!totales.total} onClick={() => setPagos([nuevoPago("efectivo", totales.total)])}>
                Pago completo en efectivo
              </Button>
            </div>
            <EditorPagos pagos={pagos} onChange={setPagos} porCobrar={totales.total} />
            {faltaCliente && <p className="text-destructive text-xs">Para dejar saldo pendiente, elige el cliente arriba.</p>}
          </div>

          <div className="grid gap-3 border-t pt-3">
            <div className="grid gap-1.5">
              <Label htmlFor="entrega">Fecha y hora de entrega</Label>
              <Input id="entrega" type="datetime-local" value={entrega} onChange={(e) => setEntrega(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notas-venta">Notas de la venta</Label>
              <Textarea id="notas-venta" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Se entrega en sucursal, factura pendiente…" />
            </div>
          </div>

          <Button type="button" size="lg" className="h-11 text-base" disabled={enviando || !lineas.length} onClick={registrar}>
            {enviando ? "Registrando…" : `Registrar venta · ${formatoMoneda(totales.total)}`}
          </Button>
          {cliente?.tipoPrecio === "revendedor" && <Badge className="justify-self-center">Precios de revendedor aplicados</Badge>}
        </CardContent>
      </Card>
    </div>
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
