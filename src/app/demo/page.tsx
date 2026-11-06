import type { Metadata } from "next";
import { Demo } from "@/components/demo";
export const metadata: Metadata = {
  title: "Demonstração · Linha CRM",
  description:
    "Experimente o kanban, tarefas e comissões com dados fictícios. Sem cadastro ou backend.",
  openGraph: {
    title: "Linha · CRM Kanban Starter",
    description: "Do primeiro contato à próxima conquista.",
    images: [{ url: "/assets/social-preview.png", width: 1280, height: 640 }],
  },
};
export default function Page() {
  return <Demo />;
}
