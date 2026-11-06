"use client";
import { useState } from "react";
import {
  MAX_CENTS,
  commissionCents,
  decimalToInteger,
  money,
} from "@/lib/domain";
import type { CrmData, SaleInput } from "@/lib/domain";

export function Sales({
  data,
  busy,
  onCreate,
}: {
  data: CrmData;
  busy: boolean;
  onCreate: (sale: SaleInput) => Promise<boolean>;
}) {
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("5");
  const available = data.leads.filter(
    (lead) => !data.deals.some((deal) => deal.lead_id === lead.id),
  );
  let preview = "—";
  try {
    preview = money(
      commissionCents(
        decimalToInteger(amount, MAX_CENTS),
        decimalToInteger(rate, 10000),
      ),
    );
  } catch {
    /* Incomplete form input has no preview. */
  }
  return (
    <>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <section className="sales-create">
        <div>
          <p className="eyebrow">Registrar conquista</p>
          <h2>Negócio fechado?</h2>
          <p>
            A comissão fica registrada com o percentual desta venda. Uma venda
            por lead.
          </p>
          <p className="small">
            Mover um card para Ganho não cria uma venda automaticamente.
            Registrar a venda move o card para Ganho.
          </p>
        </div>
        <form
          className="sales-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = new FormData(form);
            setError("");
            try {
              const amount_cents = decimalToInteger(amount, MAX_CENTS);
              if (!amount_cents)
                throw new Error("O valor da venda precisa ser maior que zero.");
              const saved = await onCreate({
                lead_id: String(values.get("lead_id") ?? ""),
                amount_cents,
                rate_bps: decimalToInteger(rate, 10000),
              });
              if (saved) {
                form.reset();
                setAmount("");
              }
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Não foi possível registrar a venda.",
              );
            }
          }}
        >
          <label>
            Lead
            <select name="lead_id" required defaultValue="">
              <option value="" disabled>
                Selecione um lead
              </option>
              {available.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} · {lead.company}
                </option>
              ))}
            </select>
          </label>
          <div className="form-pair">
            <label>
              Venda (R$)
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>
            <label>
              Comissão (%)
              <input
                inputMode="decimal"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                required
              />
            </label>
          </div>
          <p className="commission-preview">
            Comissão prevista<strong>{preview}</strong>
          </p>
          <button className="primary" disabled={busy || !available.length}>
            Registrar venda →
          </button>
          <p className="small">
            Registro definitivo neste starter. Confira os valores antes de
            salvar.
          </p>
        </form>
      </section>
      <section className="sales-history">
        <h2>
          Vendas registradas{" "}
          <span className="small">({data.deals.length})</span>
        </h2>
        {!data.deals.length ? (
          <p className="empty-state">
            Seu histórico começa com a primeira conquista.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Data</th>
                  <th>Venda</th>
                  <th>Percentual</th>
                  <th>Comissão</th>
                </tr>
              </thead>
              <tbody>
                {data.deals.map((deal) => (
                  <tr key={deal.id}>
                    <td>
                      {data.leads.find((lead) => lead.id === deal.lead_id)
                        ?.name ?? "Lead"}
                    </td>
                    <td>{deal.closed_on.split("-").reverse().join("/")}</td>
                    <td>{money(deal.amount_cents)}</td>
                    <td>{(deal.rate_bps / 100).toLocaleString("pt-BR")}%</td>
                    <td>
                      {money(
                        data.commissions.find(
                          (item) => item.deal_id === deal.id,
                        )?.amount_cents ?? 0,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
