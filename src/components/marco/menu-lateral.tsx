"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVEGACION } from "@/lib/navegacion";
import { cn } from "@/lib/utils";

export function MenuLateral({ permisos, alNavegar }: { permisos: string[]; alNavegar?: () => void }) {
  const ruta = usePathname();
  const permitidos = new Set(permisos);

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-6 [scrollbar-color:var(--sidebar-border)_transparent] [scrollbar-width:thin]" aria-label="Módulos">
      {NAVEGACION.map((grupo) => {
        const items = grupo.items.filter((i) => !i.permiso || permitidos.has(i.permiso));
        if (!items.length) return null;
        return (
          <div key={grupo.titulo} className="mt-4 first:mt-0">
            <p className="text-sidebar-foreground/50 px-2 pb-1 text-[0.7rem] font-semibold tracking-wider uppercase">
              {grupo.titulo}
            </p>
            <ul className="grid gap-0.5">
              {items.map((item) => {
                const activo = item.href === "/" ? ruta === "/" : ruta.startsWith(item.href);
                const Icono = item.icono;
                if (item.fase) {
                  return (
                    <li key={item.href}>
                      <span
                        className="text-sidebar-foreground/40 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm"
                        title={`Se construye en la fase ${item.fase}`}
                      >
                        <Icono className="size-4 shrink-0" />
                        <span className="truncate">{item.etiqueta}</span>
                        <span className="border-sidebar-border ml-auto rounded border px-1 font-mono text-[0.65rem]">
                          F{item.fase}
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={alNavegar}
                      aria-current={activo ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2",
                        activo && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                      )}
                    >
                      <Icono className={cn("size-4 shrink-0", activo && "text-sidebar-primary")} />
                      <span className="truncate">{item.etiqueta}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
