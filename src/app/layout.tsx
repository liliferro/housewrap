import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Quality Housewrap | Operations",
  description:
    "El espacio de trabajo de Quality Housewrap. Obras, estimados y avances de obra.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${archivo.variable} ${inter.variable}`}>
        <a className="skip" href="#main">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
