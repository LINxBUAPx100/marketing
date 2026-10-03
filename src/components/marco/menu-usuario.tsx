"use client";

import { LogOut } from "lucide-react";
import { salir } from "@/app/(app)/acciones-sesion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export function MenuUsuario({ nombre, correo, rol }: { nombre: string; correo: string; rol: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-muted focus-visible:ring-ring/50 flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm outline-none focus-visible:ring-2"
        aria-label="Menú de usuario"
      >
        <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-full text-xs font-semibold">
          {iniciales(nombre)}
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{nombre}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="text-foreground block truncate font-medium">{nombre}</span>
            <span className="block truncate text-xs font-normal">{correo}</span>
            <span className="block text-xs font-normal">{rol}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => salir()}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
