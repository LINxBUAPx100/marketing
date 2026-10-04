import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Imprenta · Administración",
    short_name: "Imprenta",
    description: "Ventas, producción, caja e inventario de la imprenta.",
    lang: "es-MX",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1b2333",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nueva venta", url: "/ventas/nueva", icons: [{ src: "/icon/192", sizes: "192x192" }] },
      { name: "Producción", url: "/produccion", icons: [{ src: "/icon/192", sizes: "192x192" }] },
    ],
  };
}
