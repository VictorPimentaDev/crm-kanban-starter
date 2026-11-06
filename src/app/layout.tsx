import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Linha · CRM Kanban",
  description: "Um lugar para acompanhar conversas, próximos passos e vendas.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
