import { ShieldX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SinPermiso() {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-3 py-20 text-center">
      <ShieldX className="text-muted-foreground size-10" />
      <h1 className="text-xl font-semibold">No tienes acceso a esta sección</h1>
      <p className="text-muted-foreground text-sm">
        Tu rol no incluye este permiso. Si lo necesitas, pídelo a la administración.
      </p>
      <Button nativeButton={false} render={<Link href="/" />} variant="outline">
        Volver al inicio
      </Button>
    </div>
  );
}
