export function Encabezado({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="grid min-w-0 gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{titulo}</h1>
        {descripcion ? <p className="text-muted-foreground max-w-prose text-sm">{descripcion}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
