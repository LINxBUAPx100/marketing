import { Printer } from "lucide-react";

export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-sidebar flex min-h-svh items-center justify-center p-4">
      <div className="grid w-full max-w-md gap-6">
        <div className="text-sidebar-foreground flex items-center gap-2.5">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground grid size-9 place-items-center rounded-lg">
            <Printer className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Imprenta</span>
        </div>
        {children}
      </div>
    </main>
  );
}
