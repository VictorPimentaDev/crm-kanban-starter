import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Board } from "@/components/board";
import type { Lead, Task } from "@/lib/domain";

const lead: Lead = {
  id: "lead-1",
  name: "Marina Exemplo",
  company: "Empresa fictícia",
  email: "marina@example.com",
  stage: "novo",
  value_cents: 120000,
};
const tasks: Task[] = [
  {
    id: "task-1",
    lead_id: lead.id,
    title: "Ligar",
    done: false,
    due_date: null,
  },
  {
    id: "task-2",
    lead_id: lead.id,
    title: "Pesquisa",
    done: true,
    due_date: null,
  },
  {
    id: "task-3",
    lead_id: "other",
    title: "Outra conta",
    done: false,
    due_date: null,
  },
];
function setup(busy = false) {
  const onMove = vi.fn();
  const onSelect = vi.fn();
  render(
    <Board
      leads={[lead]}
      tasks={tasks}
      busy={busy}
      onMove={onMove}
      onSelect={onSelect}
    />,
  );
  return { onMove, onSelect };
}

describe("pipeline board", () => {
  it("renders five stages and only open tasks for the card", () => {
    setup();
    expect(screen.getAllByRole("region")).toHaveLength(5);
    const column = screen.getByRole("region", { name: "Novo" });
    expect(
      within(column).getByRole("button", { name: /Marina Exemplo/ }),
    ).toBeVisible();
    expect(within(column).getByText("1 tarefas abertas")).toBeVisible();
    expect(screen.getAllByText("Nenhum lead nesta etapa.")).toHaveLength(4);
  });
  it("provides accessible move and task actions without drag", () => {
    const { onMove, onSelect } = setup();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Etapa de Marina Exemplo" }),
      { target: { value: "proposta" } },
    );
    expect(onMove).toHaveBeenCalledWith(lead.id, "proposta");
    fireEvent.click(screen.getByRole("button", { name: /Marina Exemplo/ }));
    expect(onSelect).toHaveBeenCalledWith(lead);
  });
  it("accepts a known dragged lead and rejects external payloads", () => {
    const { onMove } = setup();
    const destination = screen.getByRole("region", { name: "Qualificado" });
    fireEvent.drop(destination, { dataTransfer: { getData: () => lead.id } });
    expect(onMove).toHaveBeenCalledWith(lead.id, "qualificado");
    fireEvent.drop(destination, {
      dataTransfer: { getData: () => "unknown-id" },
    });
    expect(onMove).toHaveBeenCalledTimes(1);
  });
  it("locks drag and selects while a write is pending", () => {
    const { onMove } = setup(true);
    expect(screen.getByRole("combobox")).toBeDisabled();
    fireEvent.drop(screen.getByRole("region", { name: "Ganho" }), {
      dataTransfer: { getData: () => lead.id },
    });
    expect(onMove).not.toHaveBeenCalled();
  });
});
