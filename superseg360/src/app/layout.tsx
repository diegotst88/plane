import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuperSeg 360",
  description: "Plataforma de gestão SuperSeg Medicina e Segurança do Trabalho",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
