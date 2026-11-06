"use client";
import { money, stages } from "@/lib/domain";
import type { Lead, Stage, Task } from "@/lib/domain";

type Props = {
  leads: Lead[];
  tasks: Task[];
  busy: boolean;
  onMove: (id: string, stage: Stage) => void;
  onSelect: (lead: Lead) => void;
};
export function Board({ leads, tasks, busy, onMove, onSelect }: Props) {
  return (
    <div className="board" aria-label="Pipeline de leads">
      {stages.map((stage) => {
        const items = leads.filter((lead) => lead.stage === stage.id);
        return (
          <section
            key={stage.id}
            className={`column stage-${stage.id}`}
            aria-label={stage.label}
            onDragOver={(event) => {
              if (!busy) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/plain");
              if (
                !busy &&
                leads.some((lead) => lead.id === id && lead.stage !== stage.id)
              )
                onMove(id, stage.id);
            }}
          >
            <header className="column-heading">
              <h2>
                <span className="stage-dot" />
                {stage.label}
              </h2>
              <span>{items.length}</span>
            </header>
            <p className="column-total">
              {money(items.reduce((sum, lead) => sum + lead.value_cents, 0))}
            </p>
            <div className="cards">
              {items.map((lead) => (
                <article
                  className="lead-card"
                  key={lead.id}
                  draggable={!busy}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", lead.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <p className="company">{lead.company || "Pessoa física"}</p>
                  <button className="lead-name" onClick={() => onSelect(lead)}>
                    {lead.name}
                    <span aria-hidden="true">↗</span>
                  </button>
                  <p className="card-value">{money(lead.value_cents)}</p>
                  <p className="task-count">
                    {
                      tasks.filter(
                        (task) => task.lead_id === lead.id && !task.done,
                      ).length
                    }{" "}
                    tarefas abertas
                  </p>
                  <label className="sr-only" htmlFor={`stage-${lead.id}`}>
                    Etapa de {lead.name}
                  </label>
                  <select
                    id={`stage-${lead.id}`}
                    value={lead.stage}
                    disabled={busy}
                    onChange={(event) =>
                      onMove(lead.id, event.target.value as Stage)
                    }
                  >
                    {stages.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </div>
            {!items.length && (
              <p className="empty-column">Nenhum lead nesta etapa.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
