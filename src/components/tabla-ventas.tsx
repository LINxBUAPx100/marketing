import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/lib/numeros";

export type FilaVenta = {
  id: string;
  folio: string;
  creadoEn: Date;
  total: number;
  pagado: number;
  estado: "activa" | "cancelada";
  cliente: string | null;
  vendedor?: string | null;
  sucursal?: string | null;
  fechaEntrega?: Date | null;
};

export function estadoPago(v: Pick<FilaVenta, "estado" | "total" | "pagado">) {
  if (v.estado === "cancelada") return { texto: "Cancelada", variante: "outline" as const };
  if (v.pagado >= v.total) return { texto: "Pagada", variante: "secondary" as const };
  if (v.pagado > 0) return { texto: "Con anticipo", variante: "default" as const };
  return { texto: "Por cobrar", variante: "destructive" as const };
}

export function TablaVentas({
  ventas,
  vacio,
  mostrarCliente = true,
  mostrarEntrega = false,
}: {
  ventas: FilaVenta[];
  vacio: string;
  mostrarCliente?: boolean;
  mostrarEntrega?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Folio</TableHead>
          {mostrarCliente && <TableHead>Cliente</TableHead>}
          <TableHead className="hidden md:table-cell">{mostrarEntrega ? "Entrega" : "Fecha"}</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Saldo</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ventas.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-muted-foreground py-12 text-center">
              {vacio}
            </TableCell>
          </TableRow>
        )}
        {ventas.map((v) => {
          const estado = estadoPago(v);
          const saldo = v.estado === "activa" ? v.total - v.pagado : 0;
          return (
            <TableRow key={v.id} className={v.estado === "cancelada" ? "opacity-55" : undefined}>
              <TableCell>
                <Link href={`/ventas/${v.id}`} className="font-mono text-sm font-medium hover:underline">
                  {v.folio}
                </Link>
                {(v.vendedor || v.sucursal) && (
                  <span className="text-muted-foreground block text-xs">{[v.sucursal, v.vendedor].filter(Boolean).join(" · ")}</span>
                )}
              </TableCell>
              {mostrarCliente && <TableCell className="max-w-48 truncate">{v.cliente ?? <span className="text-muted-foreground">Público en general</span>}</TableCell>}
              <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                {mostrarEntrega ? formatoFecha(v.fechaEntrega) : formatoFechaHora(v.creadoEn)}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatoMoneda(v.total)}</TableCell>
              <TableCell className={`hidden text-right tabular-nums sm:table-cell ${saldo > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                {saldo > 0 ? formatoMoneda(saldo) : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={estado.variante}>{estado.texto}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
