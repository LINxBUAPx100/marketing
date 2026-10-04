import { ImageResponse } from "next/og";

// Íconos de la app (pestaña, acceso directo e instalación como PWA).
export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export default async function Icono({ id }: { id: Promise<string> }) {
  const lado = Number(await id);
  return new ImageResponse(<Impresora lado={lado} />, { width: lado, height: lado });
}

/** Impresora blanca sobre el azul de la marca, con margen para íconos "maskable". */
export function Impresora({ lado, redondeo = 0 }: { lado: number; redondeo?: number }) {
  const trazo = lado * 0.55;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1b2333", borderRadius: redondeo }}>
      <svg width={trazo} height={trazo} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
        <rect x="6" y="14" width="12" height="8" rx="1" />
      </svg>
    </div>
  );
}
