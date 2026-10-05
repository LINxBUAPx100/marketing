import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, t } from "@/db";
import { obtenerSesion } from "@/lib/auth";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin() {
  if (await obtenerSesion()) redirect("/");
  const [hayUsuarios] = await db.select({ id: t.usuario.id }).from(t.usuario).limit(1);
  if (!hayUsuarios) redirect("/configuracion-inicial");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Usa el correo y la contraseña que te dio la administración.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioLogin />
      </CardContent>
    </Card>
  );
}
