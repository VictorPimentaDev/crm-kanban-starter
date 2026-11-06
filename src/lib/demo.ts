import { commissionCents } from "./domain";
import type { CrmData, SaleInput } from "./domain";

export function initialDemo(): CrmData {
  return {
    leads: [
      {
        id: "marina",
        name: "Marina Exemplo",
        company: "Estúdio Aurora (fictício)",
        email: "marina@example.com",
        stage: "novo",
        value_cents: 350000,
      },
      {
        id: "caio",
        name: "Caio Modelo",
        company: "Oficina Horizonte (fictícia)",
        email: "caio@example.com",
        stage: "qualificado",
        value_cents: 720000,
      },
      {
        id: "lia",
        name: "Lia Demonstração",
        company: "Papelaria Sol (fictícia)",
        email: "lia@example.com",
        stage: "proposta",
        value_cents: 480000,
      },
      {
        id: "bia",
        name: "Bia Modelo",
        company: "Casa Brisa (fictícia)",
        email: "bia@example.com",
        stage: "ganho",
        value_cents: 600000,
      },
      {
        id: "rui",
        name: "Rui Exemplo",
        company: "Jardim Norte (fictício)",
        email: "rui@example.com",
        stage: "perdido",
        value_cents: 210000,
      },
    ],
    tasks: [
      {
        id: "task-call",
        lead_id: "marina",
        title: "Agendar conversa inicial",
        done: false,
        due_date: null,
      },
      {
        id: "task-scope",
        lead_id: "marina",
        title: "Preparar escopo de exemplo",
        done: false,
        due_date: null,
      },
    ],
    deals: [
      {
        id: "sale-bia",
        lead_id: "bia",
        amount_cents: 600000,
        rate_bps: 500,
        closed_on: "2026-11-06",
      },
    ],
    commissions: [{ deal_id: "sale-bia", amount_cents: 30000 }],
  };
}

export function recordDemoSale(
  data: CrmData,
  sale: SaleInput,
  date: string,
): CrmData {
  if (!data.leads.some((lead) => lead.id === sale.lead_id))
    throw new Error("Selecione um lead da demonstração.");
  if (data.deals.some((deal) => deal.lead_id === sale.lead_id))
    throw new Error("Este lead já tem uma venda registrada.");
  if (sale.amount_cents <= 0)
    throw new Error("O valor da venda precisa ser maior que zero.");
  const commission = commissionCents(sale.amount_cents, sale.rate_bps);
  const id = `sale-${sale.lead_id}`;
  return {
    ...data,
    leads: data.leads.map((lead) =>
      lead.id === sale.lead_id ? { ...lead, stage: "ganho" } : lead,
    ),
    deals: [...data.deals, { ...sale, id, closed_on: date }],
    commissions: [
      ...data.commissions,
      { deal_id: id, amount_cents: commission },
    ],
  };
}
