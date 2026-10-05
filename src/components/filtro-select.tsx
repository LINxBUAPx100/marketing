"use client";

/** <select> de filtro dentro de un <Buscador>: al cambiar, vuelve a buscar. */
export function FiltroSelect({
  nombre,
  valor,
  etiqueta,
  children,
}: {
  nombre: string;
  valor?: string;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={nombre}
      defaultValue={valor ?? ""}
      aria-label={etiqueta}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="border-input bg-background focus-visible:ring-ring/50 h-9 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
    >
      {children}
    </select>
  );
}
