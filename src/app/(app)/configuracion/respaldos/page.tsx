import { Download } from "lucide-react";
import type { Metadata } from "next";
import { Encabezado } from "@/components/encabezado";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requerirPermiso } from "@/lib/auth";
import { formatoFechaHora } from "@/lib/numeros";
import { listarRespaldos } from "@/lib/respaldos-automaticos";
import { BotonRespaldar } from "./boton";

export const metadata: Metadata = { title: "Respaldos" };

const tamano = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export default async function PaginaRespaldos() {
  await requerirPermiso("respaldos.ver");
  const respaldos = await listarRespaldos();
  const automaticos = process.env.RESPALDOS_AUTOMATICOS !== "0" && !process.env.VERCEL;

  return (
    <>
      <Encabezado
        titulo="Respaldos"
        descripcion="Copia completa de la información: ventas, clientes, inventario, facturas y configuración. Guárdala también fuera de esta computadora."
      >
        <Button variant="outline" nativeButton={false} render={<a href="/respaldos/actual" download />}>
          <Download /> Descargar uno ahora
        </Button>
        <BotonRespaldar />
      </Encabezado>

      <div className="mb-6 grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Automáticos</CardTitle>
            <CardDescription>
              {automaticos
                ? "El sistema guarda un respaldo al día y conserva los últimos 30."
                : "Desactivados en este servidor. Usa los respaldos de la base de datos (Supabase) o descarga uno a mano."}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Restaurar</CardTitle>
            <CardDescription>
              Se hace desde la computadora del servidor, con el sistema detenido, para no mezclar datos:{" "}
              <code className="font-mono text-xs">npm run db:restaurar -- archivo.json.gz --reemplazar</code>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Respaldo</TableHead>
              <TableHead className="hidden sm:table-cell">Fecha</TableHead>
              <TableHead className="text-right">Tamaño</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {respaldos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-12 text-center">
                  Aún no hay respaldos guardados.
                </TableCell>
              </TableRow>
            )}
            {respaldos.map((r) => (
              <TableRow key={r.nombre}>
                <TableCell className="font-mono text-xs">{r.nombre}</TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{formatoFechaHora(r.fecha)}</TableCell>
                <TableCell className="text-right tabular-nums">{tamano(r.bytes)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" aria-label={`Descargar ${r.nombre}`} nativeButton={false} render={<a href={`/respaldos/${r.nombre}`} download />}>
                    <Download />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-muted-foreground mt-3 text-xs">Los respaldos incluyen las contraseñas cifradas de los usuarios: no los compartas.</p>
    </>
  );
}
