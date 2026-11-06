import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Demo } from "@/components/demo";
import { initialDemo, recordDemoSale } from "@/lib/demo";

function registerSale(amount = "100,05", rate = "10") {
  fireEvent.click(screen.getByRole("button", { name: "Vendas" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Lead" }), {
    target: { value: "marina" },
  });
  fireEvent.change(screen.getByLabelText("Venda (R$)"), {
    target: { value: amount },
  });
  fireEvent.change(screen.getByLabelText("Comissão (%)"), {
    target: { value: rate },
  });
  fireEvent.click(screen.getByRole("button", { name: /Registrar venda/ }));
}

describe("self-contained demo", () => {
  it("moves a lead with the accessible control and restores all initial state", () => {
    render(<Demo />);
    const select = screen.getByRole("combobox", {
      name: "Etapa de Marina Exemplo",
    });
    fireEvent.change(select, { target: { value: "proposta" } });
    expect(
      within(screen.getByRole("region", { name: "Proposta" })).getByRole(
        "button",
        { name: /Marina Exemplo/ },
      ),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Restaurar demonstração" }),
    );
    expect(
      screen.getByRole("combobox", { name: "Etapa de Marina Exemplo" }),
    ).toHaveValue("novo");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Demonstração restaurada.",
    );
  });

  it("adds and completes a task without persisting it across reset", () => {
    render(<Demo />);
    fireEvent.click(screen.getByRole("button", { name: /Marina Exemplo/ }));
    expect(
      screen.getByRole("heading", { name: "Marina Exemplo" }),
    ).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Tarefa"), {
      target: { value: "Enviar proposta fictícia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tarefa" }));
    const checkbox = screen.getByRole("checkbox", {
      name: "Enviar proposta fictícia",
    });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    fireEvent.click(
      screen.getByRole("button", { name: "Restaurar demonstração" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Marina Exemplo/ }));
    expect(
      screen.queryByRole("checkbox", { name: "Enviar proposta fictícia" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("records a half-cent rounded sale, wins the lead, and resets both together", async () => {
    render(<Demo />);
    registerSale();
    expect(await screen.findByText(/Venda e comissão simuladas/)).toBeVisible();
    const row = within(screen.getByRole("table")).getByRole("row", {
      name: /Marina Exemplo/,
    });
    expect(within(row).getByText(/10,01/)).toBeVisible();
    expect(
      screen.queryByRole("option", { name: /Marina Exemplo/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pipeline" }));
    expect(
      screen.getByRole("combobox", { name: "Etapa de Marina Exemplo" }),
    ).toHaveValue("ganho");
    fireEvent.click(
      screen.getByRole("button", { name: "Restaurar demonstração" }),
    );
    expect(
      screen.getByRole("combobox", { name: "Etapa de Marina Exemplo" }),
    ).toHaveValue("novo");
    fireEvent.click(screen.getByRole("button", { name: "Vendas" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      2,
    );
    expect(
      within(screen.getByRole("table")).queryByText("Marina Exemplo"),
    ).not.toBeInTheDocument();
  });

  it("keeps invalid commission input out of the history", async () => {
    render(<Demo />);
    registerSale("100", "100.01");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Valor acima do limite permitido.",
    );
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      2,
    );
  });
});

describe("demo sales preserve the real domain constraints", () => {
  it("creates an immutable snapshot without changing seed objects", () => {
    const initial = initialDemo();
    const changed = recordDemoSale(
      initial,
      { lead_id: "marina", amount_cents: 10005, rate_bps: 1000 },
      "2026-11-06",
    );
    expect(changed.commissions.at(-1)?.amount_cents).toBe(1001);
    expect(changed.deals.at(-1)?.rate_bps).toBe(1000);
    expect(initial.leads[0].stage).toBe("novo");
    expect(initial.deals).toHaveLength(1);
    expect(() =>
      recordDemoSale(
        changed,
        { lead_id: "marina", amount_cents: 500, rate_bps: 1000 },
        "2026-11-06",
      ),
    ).toThrow(/já tem uma venda/);
  });
  it.each([
    { lead_id: "unknown", amount_cents: 100, rate_bps: 500 },
    { lead_id: "marina", amount_cents: 0, rate_bps: 500 },
    { lead_id: "marina", amount_cents: 100.5, rate_bps: 500 },
    { lead_id: "marina", amount_cents: 100, rate_bps: 10001 },
  ])("rejects invalid sale input without mutating the demo", (sale) => {
    const initial = initialDemo();
    expect(() => recordDemoSale(initial, sale, "2026-11-06")).toThrow();
    expect(initial).toEqual(initialDemo());
  });
});
