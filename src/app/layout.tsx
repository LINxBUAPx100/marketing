import type { Metadata, Viewport } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Imprenta", template: "%s · Imprenta" },
  description: "Administración de la imprenta: ventas, producción, caja e inventario.",
};

export const viewport: Viewport = { themeColor: "#1b2333" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${figtree.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
