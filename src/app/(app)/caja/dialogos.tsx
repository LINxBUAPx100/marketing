"use client";

import { ArrowDownCircle, ArrowUpCircle, Lock, PiggyBank } from "lucide-react";
import { useState } from "react";
import { Campo, Selector } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ETIQUETA_METODO, METODOS } from "@/lib/caja/resumen";
import { aCentavos, formatoMoneda } from "@/lib/numeros";
import { corte, registrarMovimiento } from "./acciones";

const CATEGORIAS_GASTO = ["Papel e insumos", "Tintas y tóner", "Renta", "Luz, agua e internet", "Sueldos", "Mantenimiento de equipo", "Transporte y envíos", "Comida", "Retiro del dueño", "Otro"];
const CATEGORIAS_INGRESO = ["Aportación del dueño", "Préstamo", "Otro"];

type Tipo = "ingreso" | "egreso" | "fondo";

const CONFIG: Record<Tipo, { titulo: string; boton: string; icono: typeof ArrowUpCircle; categorias: string[] }> = {
  egreso: { titulo: "Registrar gasto", boton: "Gasto", icono: ArrowDownCircle, categorias: CATEGORIAS_GASTO },
  ingreso: { titulo: "Registrar ingreso", boton: "Ingreso", icono: ArrowUpCircle, categorias: CATEGORIAS_INGRESO },
  fondo: { titulo: "Fondo de caja", boton: "Fondo", icono: PiggyBank, categorias: ["Fondo de caja"] },
};

export function DialogoMovimiento({ tipo, categoriasUsadas }: { tipo: Tipo; categoriasUsadas: string[] }) {
  const c = CONFIG[tipo];
  const Icono = c.icono;
  const sugerencias = [...new Set([...c.categorias, ...(tipo === "egreso" ? categoriasUsadas : [])])];
  return (
    <DialogoFormulario
      titulo={c.titulo}
      descripcion={tipo === "fondo" ? "Efectivo con el que arranca la caja para dar cambio." : undefined}
      accion={registrarMovimiento}
      disparador={
        <Button variant="outline">
          <Icono /> {c.boton}
        </Button>
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="tipo" value={tipo} />
          <Campo etiqueta="Monto" nombre="monto" inputMode="decimal" required autoFocus errores={e.monto} />
          {tipo === "fondo" ? (
            <>
              <input type="hidden" name="categoria" value="Fondo de caja" />
              <input type="hidden" name="metodo" value="efectivo" />
              <Campo etiqueta="Concepto" nombre="concepto" defaultValue="Fondo inicial de caja" required errores={e.concepto} />
            </>
          ) : (
            <>
              <Campo etiqueta="Categoría" nombre="categoria" list={`categorias-${tipo}`} required errores={e.categoria} />
              <datalist id={`categorias-${tipo}`}>
                {sugerencias.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <Campo etiqueta="Concepto" nombre="concepto" placeholder={tipo === "egreso" ? "Ej. 5 paquetes de couché 150 g" : "Ej. aportación para cambio"} required errores={e.concepto} />
              <Selector etiqueta={tipo === "egreso" ? "Se pagó con" : "Se recibió en"} nombre="metodo" defaultValue="efectivo" errores={e.metodo}>
                {METODOS.map((m) => (
                  <option key={m} value={m}>
                    {ETIQUETA_METODO[m]}
                  </option>
                ))}
              </Selector>
            </>
          )}
        </>
      )}
    </DialogoFormulario>
  );
}

export function DialogoCorte({ esperado }: { esperado: number }) {
  const [contado, setContado] = useState("");
  const centavos = aCentavos(contado);
  const diferencia = Number.isNaN(centavos) ? null : centavos - esperado;
  return (
    <DialogoFormulario
      titulo="Corte de caja"
      descripcion={`Cuenta el efectivo físico. El sistema espera ${formatoMoneda(esperado)}.`}
      accion={corte}
      textoGuardar="Hacer corte"
      disparador={
        <Button>
          <Lock /> Hacer corte
        </Button>
      }
    >
      {(e) => (
        <>
          <Campo
            etiqueta="Efectivo contado"
            nombre="efectivoContado"
            inputMode="decimal"
            required
            autoFocus
            value={contado}
            onChange={(ev) => setContado(ev.target.value)}
            errores={e.efectivoContado}
          />
          {contado && diferencia !== null && (
            <p className={`rounded-md px-3 py-2 text-sm font-medium ${diferencia === 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
              {diferencia === 0 ? "La caja cuadra." : diferencia > 0 ? `Sobran ${formatoMoneda(diferencia)}.` : `Faltan ${formatoMoneda(-diferencia)}.`}
            </p>
          )}
          <Campo
            etiqueta="Efectivo que se queda en caja"
            nombre="fondoSiguiente"
            inputMode="decimal"
            placeholder="0.00"
            ayuda="Será el fondo del siguiente periodo. El resto se retira."
            errores={e.fondoSiguiente}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="notas-corte">Notas</Label>
            <Textarea id="notas-corte" name="notas" rows={2} placeholder="Explica cualquier diferencia" />
          </div>
        </>
      )}
    </DialogoFormulario>
  );
}
