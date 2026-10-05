import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Formulario GET: los filtros viven en la URL y la página se filtra en el servidor. */
export function Buscador({
  placeholder,
  valor,
  children,
}: {
  placeholder: string;
  valor?: string;
  /** Filtros extra (selects) que también se envían. */
  children?: React.ReactNode;
}) {
  return (
    <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
      <div className="relative min-w-0 flex-1 basis-60">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input key={valor ?? ""} name="q" type="search" defaultValue={valor} placeholder={placeholder} className="h-9 pl-8" aria-label={placeholder} />
      </div>
      {children}
      <button type="submit" className="sr-only">
        Buscar
      </button>
    </form>
  );
}
