import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, t } from "@/db";
import { FormularioInicial } from "./formulario";

export const metadata: Metadata = { title: "Configuración inicial" };

export default async function PaginaConfiguracionInicial() {
  // Se consulta en cada visita; no debe quedar fija en el build.
  await connection();
  const [hayUsuarios] = await db.select({ id: t.usuario.id }).from(t.usuario).limit(1);
  if (hayUsuarios) redirect("/login");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Configura tu imprenta</CardTitle>
        <CardDescription>
          Esto se hace una sola vez. Después podrás agregar más sucursales y usuarios.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioInicial />
      </CardContent>
    </Card>
  );
}
