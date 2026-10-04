import type { Metadata } from "next";
import { Encabezado } from "@/components/encabezado";
import { requerirPermiso } from "@/lib/auth";
import { FormularioNegocio } from "./formulario";

export const metadata: Metadata = { title: "Negocio" };

export default async function PaginaNegocio() {
  const sesion = await requerirPermiso("negocio.ver");
  const n = sesion.negocio;
  return (
    <>
      <Encabezado
        titulo="Datos del negocio"
        descripcion="Aparecen en notas de venta, cotizaciones y facturas. Los datos fiscales son los del emisor de las facturas."
      />
      <FormularioNegocio
        puedeEditar={sesion.puede("negocio.editar")}
        valores={{
          nombre: n.nombre,
          razonSocial: n.razonSocial ?? "",
          rfc: n.rfc ?? "",
          regimenFiscal: n.regimenFiscal ?? "",
          codigoPostal: n.codigoPostal ?? "",
          direccion: n.direccion ?? "",
          telefono: n.telefono ?? "",
          correo: n.correo ?? "",
          iva: String(n.ivaBp / 100),
          preciosIncluyenIva: n.preciosIncluyenIva,
        }}
      />
    </>
  );
}
