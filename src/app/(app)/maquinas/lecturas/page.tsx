import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { requerirPermiso } from "@/lib/auth";
import { maquinasCompletas } from "@/lib/maquinas/consultas";
import { ETIQUETA_TIPO } from "@/lib/maquinas/reglas";
import { FormularioLecturas } from "./formulario";

export const metadata: Metadata = { title: "Capturar lecturas" };

export default async function PaginaLecturas() {
  const sesion = await requerirPermiso("maquinas.lecturas");
  if (!sesion.sucursal) return <Encabezado titulo="Capturar lecturas" descripcion="No tienes una sucursal asignada." />;
  const maquinas = await maquinasCompletas(sesion.negocio.id, [sesion.sucursal.id]);
  // Antes del mediodía lo normal es la apertura; después, el cierre.
  const hora = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Mexico_City" }).format(new Date()));

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/maquinas" />}>
        <ArrowLeft /> Máquinas
      </Button>
      <Encabezado titulo={`Lecturas de ${sesion.sucursal.nombre}`} descripcion="Escribe lo que marca cada contador. Deja vacío lo que no vayas a capturar." />
      <FormularioLecturas
        momentoInicial={hora < 13 ? "apertura" : "cierre"}
        contadores={maquinas.flatMap((m) =>
          m.contadores.map((c) => ({
            id: c.id,
            maquina: m.nombre,
            nombre: c.nombre,
            tipo: ETIQUETA_TIPO[c.tipo],
            ultima: c.ultima ? { valor: c.ultima.valor, fecha: c.ultima.creadoEn, usuario: c.ultima.usuario } : null,
          })),
        )}
      />
    </>
  );
}
