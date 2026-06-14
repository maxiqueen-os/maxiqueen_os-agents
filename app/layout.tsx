import "./globals.css";
import { Inter, Roboto_Mono } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = Roboto_Mono({ subsets: ["latin"], variable: "--font-mono" });
export const metadata = { title: "MaxiQueen OS", description: "E-Commerce Automation Engine" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
