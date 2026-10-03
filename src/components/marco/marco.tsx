"use client";

import { Menu, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { MenuLateral } from "./menu-lateral";
import { MenuUsuario } from "./menu-usuario";
import { SelectorSucursal } from "./selector-sucursal";

type Props = {
  usuario: { nombre: string; correo: string; rol: string };
  negocio: string;
  sucursales: { id: string; nombre: string }[];
  sucursalId: string | null;
  permisos: string[];
  children: React.ReactNode;
};

export function Marco({ usuario, negocio, sucursales, sucursalId, permisos, children }: Props) {
  const [abierto, setAbierto] = useState(false);

  const marca = (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <span className="bg-sidebar-primary text-sidebar-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg">
        <Printer className="size-4.5" />
      </span>
      <span className="truncate font-semibold tracking-tight">{negocio}</span>
    </div>
  );

  return (
    <div className="flex min-h-svh">
      {/* Escritorio y tablet horizontal */}
      <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-svh w-64 shrink-0 flex-col lg:flex">
        {marca}
        <MenuLateral permisos={permisos} />
      </aside>

      {/* Celular y tablet vertical */}
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent side="left" className="bg-sidebar text-sidebar-foreground w-72 border-0 p-0">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          {marca}
          <MenuLateral permisos={permisos} alNavegar={() => setAbierto(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/90 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <Menu />
          </Button>
          <SelectorSucursal sucursales={sucursales} sucursalId={sucursalId} />
          <div className="ml-auto">
            <MenuUsuario {...usuario} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
