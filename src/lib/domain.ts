export const stages = [
  { id: "novo", label: "Novo" },
  { id: "qualificado", label: "Qualificado" },
  { id: "proposta", label: "Proposta" },
  { id: "ganho", label: "Ganho" },
  { id: "perdido", label: "Perdido" },
] as const;
export type Stage = (typeof stages)[number]["id"];
export type Lead = {
  id: string;
  name: string;
  company: string;
  email: string;
  stage: Stage;
  value_cents: number;
};
export type Task = {
  id: string;
  lead_id: string;
  title: string;
  done: boolean;
  due_date: string | null;
};
export type Deal = {
  id: string;
  lead_id: string;
  amount_cents: number;
  rate_bps: number;
  closed_on: string;
};
export type Commission = { deal_id: string; amount_cents: number };
export const MAX_CENTS = 1_000_000_000;

// Parse decimal text rather than multiplying binary floating-point money.
export function decimalToInteger(input: string, max: number): number {
  const value = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Use um número positivo com até duas casas decimais.");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > max)
    throw new Error("Valor acima do limite permitido.");
  return result;
}

export function commissionCents(amount: number, rateBps: number): number {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > MAX_CENTS ||
    !Number.isInteger(rateBps) ||
    rateBps < 0 ||
    rateBps > 10_000
  ) {
    throw new Error("Valor ou percentual de comissão inválido.");
  }
  return Math.floor((amount * rateBps + 5_000) / 10_000);
}

export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );

export type CrmData = {
  leads: Lead[];
  tasks: Task[];
  deals: Deal[];
  commissions: Commission[];
};
export type SaleInput = Pick<Deal, "lead_id" | "amount_cents" | "rate_bps">;
