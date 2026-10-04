"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Selector } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { validarLectura } from "@/lib/maquinas/reglas";
import { formatoCantidad, formatoFechaHora } from "@/lib/numeros";
import { guardarLecturas } from "../acciones";

type Contador = { id: string; maquina: string; nombre: string; tipo: string; ultima: { valor: number; fecha: Date; usuario: string } | null };

export function FormularioLecturas({ contadores, momentoInicial }: { contadores: Contador[]; momentoInicial: "apertura" | "cierre" }) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [momento, setMomento] = useState<"apertura" | "cierre" | "otra">(momentoInicial);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [nota, setNota] = useState("");

  const capturadas = contadores
    .filter((c) => valores[c.id]?.trim())
    .map((c) => {
      const valor = Number(valores[c.id].replace(/,/g, ""));
      return { contador: c, valor, error: validarLectura(valor, c.ultima?.valor ?? null) };
    });

  function guardar() {
    if (!capturadas.length) return toast.error("Escribe al menos una lectura.");
    if (capturadas.some((c) => c.error)) return toast.error("Corrige las lecturas marcadas en rojo.");
    iniciar(async () => {
      const r = await guardarLecturas({ momento, nota: nota || null, lecturas: capturadas.map((c) => ({ contadorId: c.contador.id, valor: c.valor })) });
      if (!r.ok) return void toast.error(r.mensaje);
      toast.success(`${r.guardadas} ${r.guardadas === 1 ? "lectura guardada" : "lecturas guardadas"}.`);
      router.push("/maquinas");
    });
  }

  if (!contadores.length) return <p className="text-muted-foreground">No hay equipos registrados en esta sucursal.</p>;

  return (
    <Card className="max-w-3xl">
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Selector etiqueta="Momento" nombre="momento" value={momento} onChange={(e) => setMomento(e.target.value as typeof momento)}>
            <option value="apertura">Apertura del día</option>
            <option value="cierre">Cierre del día</option>
            <option value="otra">Otra</option>
          </Selector>
          <label className="grid gap-1.5 text-sm font-medium">
            Nota
            <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
          </label>
        </div>

        <ul className="divide-y rounded-lg border">
          {contadores.map((c) => {
            const capturada = capturadas.find((x) => x.contador.id === c.id);
            const diferencia = capturada && !capturada.error && c.ultima ? capturada.valor - c.ultima.valor : null;
            return (
              <li key={c.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_10rem] sm:items-center">
                <div className="min-w-0">
                  <p className="font-medium">
                    {c.maquina} · {c.nombre} <span className="text-muted-foreground text-xs font-normal">{c.tipo}</span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {c.ultima ? `Última: ${formatoCantidad(c.ultima.valor)} · ${formatoFechaHora(c.ultima.fecha)} · ${c.ultima.usuario}` : "Sin lecturas"}
                  </p>
                  {capturada?.error && <p className="text-destructive text-xs">{capturada.error}</p>}
                  {diferencia != null && <p className="text-xs text-emerald-700">+{formatoCantidad(diferencia)} impresiones desde la última lectura</p>}
                </div>
                <Input
                  inputMode="numeric"
                  value={valores[c.id] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
                  placeholder={c.ultima ? String(c.ultima.valor) : "Lectura"}
                  aria-label={`Lectura de ${c.maquina} ${c.nombre}`}
                  aria-invalid={capturada?.error ? true : undefined}
                  className="h-10 text-right font-mono text-base tabular-nums"
                />
              </li>
            );
          })}
        </ul>

        <Button type="button" size="lg" onClick={guardar} disabled={guardando || !capturadas.length}>
          {guardando ? "Guardando…" : `Guardar ${capturadas.length || ""} ${capturadas.length === 1 ? "lectura" : "lecturas"}`}
        </Button>
      </CardContent>
    </Card>
  );
}
