import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite carga archivos WASM desde su paquete; no debe empaquetarse.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Imágenes de productos de hasta 3 MB (src/lib/archivos.ts) más el margen del formulario.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
