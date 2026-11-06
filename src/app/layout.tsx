import type { Metadata } from "next";
import "./globals.css";
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const metadata: Metadata = {
  metadataBase: new URL(
    productionHost ? `https://${productionHost}` : "http://localhost:3000",
  ),
  title: "Linha · CRM Kanban",
  description: "Um lugar para acompanhar conversas, próximos passos e vendas.",
  openGraph: {
    title: "Linha · CRM Kanban Starter",
    description: "Do primeiro contato à próxima conquista.",
    images: [{ url: "/assets/social-preview.png", width: 1280, height: 640 }],
  },
  twitter: { card: "summary_large_image" },
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
