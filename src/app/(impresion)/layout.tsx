export default function LayoutImpresion({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-white text-black print:min-h-0">{children}</div>;
}
