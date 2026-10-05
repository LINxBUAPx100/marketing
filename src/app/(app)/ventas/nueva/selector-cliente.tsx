"use client";

import { UserPlus, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarClientes } from "../../clientes/acciones";
import { DialogoCliente } from "../../clientes/dialogo";

export type ClienteVenta = { id: string; nombre: string; empresa: string | null; telefono: string | null; tipoPrecio: "publico" | "revendedor" };

export function SelectorCliente({
  cliente,
  onChange,
  puedeCrear,
}: {
  cliente: ClienteVenta | null;
  onChange: (c: ClienteVenta | null) => void;
  puedeCrear: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ClienteVenta[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [, iniciar] = useTransition();
  const contenedor = useRef<HTMLDivElement>(null);

  // Busca 250 ms después de que se deja de escribir.
  useEffect(() => {
    if (!abierto) return;
    const temporizador = setTimeout(() => iniciar(async () => setResultados(await buscarClientes(texto))), 250);
    return () => clearTimeout(temporizador);
  }, [texto, abierto]);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  if (cliente) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
        <UserRound className="text-muted-foreground size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{cliente.nombre}</p>
          {(cliente.empresa || cliente.telefono) && (
            <p className="text-muted-foreground truncate text-xs">{[cliente.empresa, cliente.telefono].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {cliente.tipoPrecio === "revendedor" && <Badge>Revendedor</Badge>}
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar cliente" onClick={() => onChange(null)}>
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div ref={contenedor} className="relative flex gap-2">
      <Input
        id="buscar-cliente"
        value={texto}
        placeholder="Público en general · buscar cliente"
        aria-label="Buscar cliente"
        autoComplete="off"
        role="combobox"
        aria-expanded={abierto}
        aria-controls="clientes-encontrados"
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAbierto(false);
          if (e.key === "Enter" && resultados[0]) {
            e.preventDefault();
            onChange(resultados[0]);
            setTexto("");
            setAbierto(false);
          }
        }}
      />
      {puedeCrear && (
        <DialogoCliente
          nombreInicial={texto}
          disparador={
            <Button type="button" variant="outline" size="icon" aria-label="Registrar cliente nuevo">
              <UserPlus />
            </Button>
          }
          alGuardar={(r) => r.datos && onChange(r.datos as ClienteVenta)}
        />
      )}
      {abierto && (
        <ul
          id="clientes-encontrados"
          role="listbox"
          className="bg-popover absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border p-1 shadow-lg"
        >
          {resultados.length === 0 && <li className="text-muted-foreground px-3 py-2 text-sm">Sin resultados.</li>}
          {resultados.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none"
                onClick={() => {
                  onChange(c);
                  setTexto("");
                  setAbierto(false);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.nombre}</span>
                  <span className="text-muted-foreground block truncate text-xs">{[c.empresa, c.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span>
                </span>
                {c.tipoPrecio === "revendedor" && <Badge>Revendedor</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
