import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { articulosConExistencia, proveedoresActivos } from "@/lib/almacen/consultas";
import { requerirPermiso } from "@/lib/auth";
import { hoyEnMexico } from "@/lib/fechas";
import { FormularioCompra } from "./formulario";

export const metadata: Metadata = { title: "Nueva compra" };

export default async function PaginaNuevaCompra() {
  const sesion = await requerirPermiso("cxp.crear");
  if (!sesion.sucursal) return <Encabezado titulo="Nueva compra" descripcion="No tienes una sucursal asignada." />;
  const [articulos, proveedores] = await Promise.all([articulosConExistencia(sesion.negocio.id, sesion.sucursal.id), proveedoresActivos(sesion.negocio.id)]);

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/cuentas-por-pagar" />}>
        <ArrowLeft /> Cuentas por pagar
      </Button>
      <Encabezado titulo="Registrar compra" descripcion={`La mercancía entra a ${sesion.sucursal.nombre}.`} />
      <FormularioCompra articulos={articulos} proveedores={proveedores} hoy={hoyEnMexico()} sucursal={sesion.sucursal.nombre} puedePagar={sesion.puede("cxp.pagar")} />
    </>
  );
}
