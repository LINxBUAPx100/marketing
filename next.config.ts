import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite carga archivos WASM desde su paquete; no debe empaquetarse.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
