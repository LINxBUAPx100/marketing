import type { Metadata } from "next";
import { Encabezado } from "@/components/encabezado";
import { requerirPermiso } from "@/lib/auth";
import { CONDICIONES_INICIALES } from "@/lib/cotizaciones/servidor";
import { hoyEnMexico } from "@/lib/fechas";
import { catalogoParaVender, clientePorId } from "@/lib/ventas/consultas";
import { EditorCotizacion } from "../editor";

export const metadata: Metadata = { title: "Nueva cotización" };

/** "2026-10-03" + 15 días → "2026-10-18" */
const sumarDias = (fecha: string, dias: number) => new Date(new Date(`${fecha}T12:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);

export default async function PaginaNuevaCotizacion({ searchParams }: PageProps<"/cotizaciones/nueva">) {
  const sesion = await requerirPermiso("cotizaciones.crear");
  if (!sesion.sucursal) return <Encabezado titulo="Nueva cotización" descripcion="No tienes una sucursal asignada." />;
  const { cliente: clienteId } = (await searchParams) as Record<string, string | undefined>;
  const [{ productos, categorias }, cliente] = await Promise.all([catalogoParaVender(sesion), clientePorId(sesion, clienteId)]);

  return (
    <EditorCotizacion
      productos={productos}
      categorias={categorias}
      iva={{ ivaBp: sesion.negocio.ivaBp, preciosIncluyenIva: sesion.negocio.preciosIncluyenIva }}
      puedeDescontar={sesion.puede("ventas.descuento")}
      puedeCrearCliente={sesion.puede("clientes.crear")}
      inicial={{
        id: null,
        folio: null,
        cliente,
        vigenciaHasta: sumarDias(hoyEnMexico(), 15),
        notas: "",
        condiciones: CONDICIONES_INICIALES,
        partidas: [],
      }}
    />
  );
}
