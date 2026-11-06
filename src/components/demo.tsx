"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Board } from "./board";
import { Brand } from "./brand";
import { Sales } from "./sales";
import { initialDemo, recordDemoSale } from "@/lib/demo";
import { money } from "@/lib/domain";

export function Demo() {
  const [data, setData] = useState(initialDemo);
  const [view, setView] = useState<"pipeline" | "sales">("pipeline");
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const taskHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (selected) taskHeading.current?.focus();
  }, [selected]);
  const activeLead = data.leads.find((lead) => lead.id === selected);
  const open = data.leads.filter(
    (lead) => !["ganho", "perdido"].includes(lead.stage),
  );
  return (
    <div className="workspace">
      <header className="topbar">
        <Brand />
        <nav aria-label="Demonstração">
          <button
            aria-current={view === "pipeline" ? "page" : undefined}
            onClick={() => {
              setView("pipeline");
              setNotice("");
            }}
          >
            Pipeline
          </button>
          <button
            aria-current={view === "sales" ? "page" : undefined}
            onClick={() => {
              setView("sales");
              setSelected(null);
              setNotice("");
            }}
          >
            Vendas
          </button>
        </nav>
        <div className="account">
          <Link href="https://github.com/VictorPimentaDev/crm-kanban-starter">
            Código no GitHub ↗
          </Link>
        </div>
      </header>
      <aside className="demo-banner" aria-label="Sobre a demonstração">
        <p>
          <strong>Demonstração</strong> — dados fictícios, alterações nesta
          sessão. Recarregar a página também restaura os exemplos.
        </p>
        <button
          onClick={() => {
            setData(initialDemo());
            setSelected(null);
            setView("pipeline");
            setNotice("Demonstração restaurada.");
          }}
        >
          Restaurar demonstração
        </button>
      </aside>
      <main className="main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Seu negócio, em movimento</p>
            <h1>
              {view === "pipeline"
                ? "Toda conversa conta."
                : "Conquistas na conta."}
            </h1>
            <p>
              {view === "pipeline"
                ? "Mova um card. Abra suas tarefas. Experimente o próximo passo."
                : "Simule uma venda e veja a comissão calculada em centavos."}
            </p>
          </div>
          <span className="page-number">
            {view === "pipeline" ? "01 / PIPELINE" : "02 / VENDAS"}
          </span>
        </div>
        <div className="metrics">
          <div>
            <span>Pipeline aberto</span>
            <strong>
              {money(open.reduce((sum, lead) => sum + lead.value_cents, 0))}
            </strong>
            <small>{open.length} oportunidades fictícias</small>
          </div>
          <div>
            <span>Vendas registradas</span>
            <strong>
              {money(
                data.deals.reduce((sum, deal) => sum + deal.amount_cents, 0),
              )}
            </strong>
            <small>{data.deals.length} negócios de exemplo</small>
          </div>
          <div>
            <span>Comissões</span>
            <strong>
              {money(
                data.commissions.reduce(
                  (sum, commission) => sum + commission.amount_cents,
                  0,
                ),
              )}
            </strong>
            <small>Percentual fixado em cada venda</small>
          </div>
          <div>
            <span>Próximos passos</span>
            <strong>
              {String(data.tasks.filter((task) => !task.done).length).padStart(
                2,
                "0",
              )}
            </strong>
            <small>Tarefas em aberto</small>
          </div>
        </div>
        <p role="status" className="status">
          {notice}
        </p>
        {view === "pipeline" ? (
          <>
            <div className="toolbar">
              <p className="small">
                Arraste um card ou escolha a etapa. Clique no nome para ver as
                tarefas.
              </p>
            </div>
            <Board
              leads={data.leads}
              tasks={data.tasks}
              busy={false}
              onSelect={(lead) => setSelected(lead.id)}
              onMove={(id, stage) => {
                setData((current) => ({
                  ...current,
                  leads: current.leads.map((lead) =>
                    lead.id === id ? { ...lead, stage } : lead,
                  ),
                }));
                setNotice("Etapa atualizada nesta demonstração.");
              }}
            />
            {activeLead && (
              <section
                className="task-panel"
                aria-label={`Tarefas de ${activeLead.name}`}
              >
                <header>
                  <div>
                    <p className="eyebrow">Próximos passos</p>
                    <h2 ref={taskHeading} tabIndex={-1}>
                      {activeLead.name}
                    </h2>
                    <p>{activeLead.email}</p>
                  </div>
                  <button onClick={() => setSelected(null)}>Fechar ×</button>
                </header>
                <ul className="task-list">
                  {data.tasks
                    .filter((task) => task.lead_id === activeLead.id)
                    .map((task) => (
                      <li key={task.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={() => {
                              setData((current) => ({
                                ...current,
                                tasks: current.tasks.map((item) =>
                                  item.id === task.id
                                    ? { ...item, done: !item.done }
                                    : item,
                                ),
                              }));
                              setNotice(
                                "Tarefa atualizada nesta demonstração.",
                              );
                            }}
                          />
                          <span className={task.done ? "done" : ""}>
                            {task.title}
                          </span>
                        </label>
                      </li>
                    ))}
                </ul>
                <form
                  className="inline-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const title = String(
                      new FormData(form).get("title") ?? "",
                    ).trim();
                    if (!title || title.length > 200) {
                      setNotice("Informe uma tarefa com até 200 caracteres.");
                      return;
                    }
                    const id = crypto.randomUUID();
                    setData((current) => ({
                      ...current,
                      tasks: [
                        ...current.tasks,
                        {
                          id,
                          title,
                          lead_id: activeLead.id,
                          done: false,
                          due_date: null,
                        },
                      ],
                    }));
                    form.reset();
                    setNotice("Tarefa adicionada nesta demonstração.");
                  }}
                >
                  <label>
                    Tarefa
                    <input
                      name="title"
                      required
                      maxLength={200}
                      placeholder="Ex.: enviar proposta de exemplo"
                    />
                  </label>
                  <button className="primary">Adicionar tarefa</button>
                </form>
              </section>
            )}
          </>
        ) : (
          <Sales
            data={data}
            busy={false}
            onCreate={async (sale) => {
              setData(
                recordDemoSale(
                  data,
                  sale,
                  new Date().toISOString().slice(0, 10),
                ),
              );
              setNotice(
                "Venda e comissão simuladas. Nenhum dado foi enviado a um servidor.",
              );
              return true;
            }}
          />
        )}
        <footer>
          Linha / CRM starter
          <span>Dados fictícios. Nenhuma integração externa.</span>
        </footer>
      </main>
    </div>
  );
}
