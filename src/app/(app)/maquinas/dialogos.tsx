"use client";

import { Droplet, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Campo, Selector } from "@/components/campo";
import { DialogoFormulario } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ETIQUETA_MOTIVO_MERMA, ETIQUETA_TIPO, type TipoImpresion } from "@/lib/maquinas/reglas";
import { guardarConsumible, guardarMaquina, guardarMerma, nuevoContador, retirar } from "./acciones";

type Opcion = { id: string; nombre: string };
const TIPOS = Object.entries(ETIQUETA_TIPO) as [TipoImpresion, string][];

// ─── Máquina ────────────────────────────────────────────────────────────────

type ContadorNuevo = { nombre: string; tipo: TipoImpresion; lecturaInicial: string };
export type ValoresMaquina = { id: string; sucursalId: string; nombre: string; marca: string; modelo: string; serie: string; notas: string; activa: boolean };

export function DialogoMaquina({ maquina, sucursales, sucursalActual }: { maquina?: ValoresMaquina; sucursales: Opcion[]; sucursalActual: string | null }) {
  const editando = !!maquina;
  const [contadores, setContadores] = useState<ContadorNuevo[]>([{ nombre: "Negro", tipo: "byn", lecturaInicial: "" }]);
  const cambiar = (i: number, c: Partial<ContadorNuevo>) => setContadores((cs) => cs.map((x, j) => (j === i ? { ...x, ...c } : x)));

  return (
    <DialogoFormulario
      titulo={editando ? `Editar ${maquina.nombre}` : "Nuevo equipo"}
      descripcion={editando ? undefined : "Registra la impresora, copiadora o plotter y la lectura actual de cada contador."}
      accion={guardarMaquina}
      ancho="sm:max-w-xl"
      disparador={
        editando ? (
          <Button variant="outline">
            <Pencil /> Editar
          </Button>
        ) : (
          <Button>
            <Plus /> Nuevo equipo
          </Button>
        )
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="id" value={maquina?.id ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre" nombre="nombre" defaultValue={maquina?.nombre} placeholder="Ej. Color 1, Plotter" required autoFocus errores={e.nombre} />
            <Selector etiqueta="Sucursal" nombre="sucursalId" defaultValue={maquina?.sucursalId ?? sucursalActual ?? ""} errores={e.sucursalId}>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </Selector>
            <Campo etiqueta="Marca" nombre="marca" defaultValue={maquina?.marca} errores={e.marca} />
            <Campo etiqueta="Modelo" nombre="modelo" defaultValue={maquina?.modelo} errores={e.modelo} />
            <Campo etiqueta="Número de serie" nombre="serie" defaultValue={maquina?.serie} errores={e.serie} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notas-maquina">Notas</Label>
            <Textarea id="notas-maquina" name="notas" rows={2} defaultValue={maquina?.notas} placeholder="Contrato de servicio, técnico…" />
          </div>

          {editando ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="hidden" name="activa" value="false" />
              <input type="checkbox" name="activa" value="true" defaultChecked={maquina.activa} className="accent-primary size-4" />
              Equipo en uso
            </label>
          ) : (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Contadores</legend>
              <input type="hidden" name="contadores" value={JSON.stringify(contadores.map((c) => ({ ...c, lecturaInicial: Number(c.lecturaInicial) })))} />
              {contadores.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_9rem_7rem_auto] items-center gap-2">
                  <Input value={c.nombre} onChange={(ev) => cambiar(i, { nombre: ev.target.value })} placeholder="Nombre" aria-label="Nombre del contador" />
                  <select
                    value={c.tipo}
                    onChange={(ev) => cambiar(i, { tipo: ev.target.value as TipoImpresion })}
                    aria-label="Tipo de impresión"
                    className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
                  >
                    {TIPOS.map(([v, et]) => (
                      <option key={v} value={v}>
                        {et}
                      </option>
                    ))}
                  </select>
                  <Input
                    inputMode="numeric"
                    value={c.lecturaInicial}
                    onChange={(ev) => cambiar(i, { lecturaInicial: ev.target.value })}
                    placeholder="Lectura"
                    aria-label="Lectura actual"
                    className="tabular-nums"
                  />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar contador" disabled={contadores.length === 1} onClick={() => setContadores((cs) => cs.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setContadores((cs) => [...cs, { nombre: "Color", tipo: "color", lecturaInicial: "" }])}>
                <Plus /> Agregar contador
              </Button>
              {e.contadores && <p className="text-destructive text-sm">{e.contadores[0]}</p>}
              <p className="text-muted-foreground text-xs">Escribe exactamente lo que marca el equipo hoy; desde ahí se cuentan las impresiones.</p>
            </fieldset>
          )}
        </>
      )}
    </DialogoFormulario>
  );
}

export function DialogoContador({ maquinaId }: { maquinaId: string }) {
  return (
    <DialogoFormulario
      titulo="Agregar contador"
      accion={nuevoContador}
      disparador={
        <Button variant="ghost" size="sm">
          <Plus /> Contador
        </Button>
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="maquinaId" value={maquinaId} />
          <Campo etiqueta="Nombre" nombre="nombre" placeholder="Ej. Color, Escáner, m²" required autoFocus errores={e.nombre} />
          <Selector etiqueta="Tipo de impresión" nombre="tipo" defaultValue="color" errores={e.tipo}>
            {TIPOS.map(([v, et]) => (
              <option key={v} value={v}>
                {et}
              </option>
            ))}
          </Selector>
          <Campo etiqueta="Lectura actual" nombre="lecturaInicial" inputMode="numeric" required errores={e.lecturaInicial} />
        </>
      )}
    </DialogoFormulario>
  );
}

// ─── Mermas ─────────────────────────────────────────────────────────────────

type MaquinaOpcion = { id: string; nombre: string; tipos: TipoImpresion[] };

export function DialogoMerma({ maquinas, usuarios, usuarioActual, maquinaInicial }: { maquinas: MaquinaOpcion[]; usuarios: Opcion[]; usuarioActual: string; maquinaInicial?: string }) {
  const [maquinaId, setMaquinaId] = useState(maquinaInicial ?? maquinas[0]?.id ?? "");
  const tipos = maquinas.find((m) => m.id === maquinaId)?.tipos ?? [];
  return (
    <DialogoFormulario
      titulo="Registrar merma"
      descripcion="Impresiones que salieron mal y no se cobran: así no cuentan como fantasma."
      accion={guardarMerma}
      textoGuardar="Registrar"
      disparador={
        <Button variant="outline">
          <TriangleAlert /> Merma
        </Button>
      }
    >
      {(e) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Selector etiqueta="Equipo" nombre="maquinaId" value={maquinaId} onChange={(ev) => setMaquinaId(ev.target.value)} errores={e.maquinaId}>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </Selector>
            <Selector etiqueta="Tipo" nombre="tipo" key={maquinaId} defaultValue={tipos[0]} errores={e.tipo}>
              {tipos.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETA_TIPO[tipo]}
                </option>
              ))}
            </Selector>
            <Campo etiqueta="Impresiones" nombre="cantidad" inputMode="decimal" required autoFocus errores={e.cantidad} />
            <Selector etiqueta="Motivo" nombre="motivo" defaultValue="atasco" errores={e.motivo}>
              {Object.entries(ETIQUETA_MOTIVO_MERMA).map(([v, et]) => (
                <option key={v} value={v}>
                  {et}
                </option>
              ))}
            </Selector>
            <Selector etiqueta="¿Quién la provocó?" nombre="responsableId" defaultValue={usuarioActual} errores={e.responsableId}>
              <option value="">Nadie en particular</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </Selector>
          </div>
          <Campo etiqueta="Nota" nombre="nota" placeholder="Ej. trabajo MAT-0004, salió corrida la tinta" errores={e.nota} />
        </>
      )}
    </DialogoFormulario>
  );
}

// ─── Consumibles ────────────────────────────────────────────────────────────

export function DialogoConsumible({
  maquinaId,
  contadores,
  insumos,
}: {
  maquinaId: string;
  contadores: { id: string; nombre: string }[];
  insumos: { id: string; nombre: string; existencia: number }[];
}) {
  return (
    <DialogoFormulario
      titulo="Instalar consumible"
      descripcion="Se toma la lectura actual del contador. Si ya había uno con el mismo nombre, se retira en este momento."
      accion={guardarConsumible}
      textoGuardar="Instalar"
      disparador={
        <Button variant="outline" size="sm">
          <Droplet /> Instalar consumible
        </Button>
      }
    >
      {(e) => (
        <>
          <input type="hidden" name="maquinaId" value={maquinaId} />
          <Campo etiqueta="Qué se instala" nombre="nombre" list="consumibles-comunes" placeholder="Tóner negro" required autoFocus errores={e.nombre} />
          <datalist id="consumibles-comunes">
            {["Tóner negro", "Tóner cian", "Tóner magenta", "Tóner amarillo", "Tambor (drum)", "Unidad de revelado", "Fusor", "Banda de transferencia", "Cartucho de tinta"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="grid gap-4 sm:grid-cols-2">
            <Selector etiqueta="Se mide con el contador" nombre="contadorId" errores={e.contadorId}>
              {contadores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
            <Campo etiqueta="Rendimiento (impresiones)" nombre="rendimiento" inputMode="numeric" placeholder="28000" required errores={e.rendimiento} />
            <Selector etiqueta="Sale del almacén" nombre="insumoId" defaultValue="" errores={e.insumoId}>
              <option value="">No (lo trajo el técnico)</option>
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} · hay {i.existencia}
                </option>
              ))}
            </Selector>
            <Campo etiqueta="Costo" nombre="costo" inputMode="decimal" placeholder="Opcional" ayuda="Si sale del almacén, se usa su costo." errores={e.costo} />
          </div>
        </>
      )}
    </DialogoFormulario>
  );
}

export function BotonRetirar({ id, nombre }: { id: string; nombre: string }) {
  const [pendiente, iniciar] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  if (!confirmar) {
    return (
      <Button variant="ghost" size="xs" onClick={() => setConfirmar(true)}>
        Retirar
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Button
        variant="destructive"
        size="xs"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await retirar(id);
            if (!r.ok) toast.error(r.mensaje);
            else toast.success(`${nombre} retirado.`);
            setConfirmar(false);
          })
        }
      >
        Confirmar retiro
      </Button>
      <Button variant="ghost" size="xs" onClick={() => setConfirmar(false)}>
        No
      </Button>
    </span>
  );
}

