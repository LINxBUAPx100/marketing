"use client";

import { Banknote, CreditCard, Landmark, ReceiptText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ETIQUETA_METODO, METODOS, type Metodo } from "@/lib/caja/resumen";
import { aCentavos, centavosATexto, formatoMoneda } from "@/lib/numeros";
import { cn } from "@/lib/utils";

export type PagoEditable = { clave: number; metodo: Metodo; monto: string; recibido: string; referencia: string };

const ICONOS: Record<Metodo, typeof Banknote> = { efectivo: Banknote, tarjeta: CreditCard, transferencia: Landmark, cheque: ReceiptText };
let siguienteClave = 1;

export const nuevoPago = (metodo: Metodo, monto = 0): PagoEditable => ({
  clave: siguienteClave++,
  metodo,
  monto: monto ? centavosATexto(monto) : "",
  recibido: "",
  referencia: "",
});

/** Pagos listos para mandar al servidor (centavos). */
export function pagosParaEnviar(pagos: PagoEditable[]) {
  return pagos
    .map((p) => {
      const monto = aCentavos(p.monto);
      const recibido = p.metodo === "efectivo" && p.recibido.trim() ? aCentavos(p.recibido) : null;
      return { metodo: p.metodo, monto, recibido, referencia: p.referencia.trim() || null };
    })
    // Los montos vacíos se ignoran; los mal escritos (NaN) se quedan para marcarlos como inválidos.
    .filter((p) => Number.isNaN(p.monto) || p.monto > 0);
}

export function resumenPagos(pagos: PagoEditable[], porCobrar: number) {
  const enviables = pagosParaEnviar(pagos);
  const pagado = enviables.reduce((s, p) => s + (Number.isNaN(p.monto) ? 0 : p.monto), 0);
  const cambio = enviables.reduce((s, p) => s + (p.recibido != null && p.recibido > p.monto ? p.recibido - p.monto : 0), 0);
  const invalido = enviables.some((p) => Number.isNaN(p.monto) || (p.recibido != null && (Number.isNaN(p.recibido) || p.recibido < p.monto)));
  return { pagado, saldo: porCobrar - pagado, cambio, invalido, excedido: pagado > porCobrar };
}

export function EditorPagos({
  pagos,
  onChange,
  porCobrar,
}: {
  pagos: PagoEditable[];
  onChange: (pagos: PagoEditable[]) => void;
  porCobrar: number;
}) {
  const r = resumenPagos(pagos, porCobrar);
  const cambiar = (clave: number, cambios: Partial<PagoEditable>) =>
    onChange(pagos.map((p) => (p.clave === clave ? { ...p, ...cambios } : p)));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {METODOS.map((m) => {
          const Icono = ICONOS[m];
          return (
            <Button
              key={m}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange([...pagos, nuevoPago(m, Math.max(0, r.saldo))])}
            >
              <Icono /> {m === "transferencia" ? "Transferencia" : ETIQUETA_METODO[m]}
            </Button>
          );
        })}
      </div>

      {pagos.length === 0 && (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-3 text-center text-sm">
          Sin pagos: todo queda como saldo pendiente.
        </p>
      )}

      {pagos.map((p) => {
        const Icono = ICONOS[p.metodo];
        const monto = aCentavos(p.monto);
        const recibido = aCentavos(p.recibido);
        return (
          <div key={p.clave} className="bg-muted/40 grid gap-2 rounded-lg border p-2.5">
            <div className="flex items-center gap-2">
              <Icono className="text-muted-foreground size-4 shrink-0" />
              <span className="flex-1 text-sm font-medium">{ETIQUETA_METODO[p.metodo]}</span>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Quitar pago" onClick={() => onChange(pagos.filter((x) => x.clave !== p.clave))}>
                <X />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">Monto</span>
                <Input
                  inputMode="decimal"
                  value={p.monto}
                  onChange={(e) => cambiar(p.clave, { monto: e.target.value })}
                  aria-invalid={p.monto !== "" && Number.isNaN(monto) ? true : undefined}
                  className="tabular-nums"
                />
              </label>
              {p.metodo === "efectivo" ? (
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">Recibido</span>
                  <Input
                    inputMode="decimal"
                    value={p.recibido}
                    placeholder={p.monto || "0.00"}
                    onChange={(e) => cambiar(p.clave, { recibido: e.target.value })}
                    aria-invalid={p.recibido !== "" && (Number.isNaN(recibido) || recibido < monto) ? true : undefined}
                    className="tabular-nums"
                  />
                </label>
              ) : (
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">Referencia</span>
                  <Input value={p.referencia} placeholder="Opcional" onChange={(e) => cambiar(p.clave, { referencia: e.target.value })} />
                </label>
              )}
            </div>
          </div>
        );
      })}

      <dl className="grid gap-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Pagado</dt>
          <dd className="tabular-nums">{formatoMoneda(r.pagado)}</dd>
        </div>
        {r.cambio > 0 && (
          <div className="flex justify-between font-semibold text-emerald-700">
            <dt>Cambio</dt>
            <dd className="tabular-nums">{formatoMoneda(r.cambio)}</dd>
          </div>
        )}
        <div className={cn("flex justify-between font-medium", r.saldo > 0 ? "text-destructive" : "text-muted-foreground")}>
          <dt>{r.excedido ? "Pagos de más" : "Saldo pendiente"}</dt>
          <dd className="tabular-nums">{formatoMoneda(Math.abs(r.saldo))}</dd>
        </div>
      </dl>
    </div>
  );
}
