"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Board } from "./board";
import { Brand } from "./brand";
import { Sales } from "./sales";
import { MAX_CENTS, decimalToInteger, money } from "@/lib/domain";
import type { Commission, CrmData, Deal, Lead, Task } from "@/lib/domain";
import { supabase } from "@/lib/supabase";

type View = "pipeline" | "sales";
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível completar a operação. Tente novamente.";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
function checked(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function Workspace({ view }: { view: View }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!supabase)
    return (
      <main className="setup">
        <Brand />
        <p className="eyebrow">Primeiro passo</p>
        <h1>
          Seu próximo negócio
          <br />
          começa aqui.
        </h1>
        <p>Explore o pipeline, organize tarefas e simule sua próxima venda.</p>
        <Link href="/demo" className="primary demo-link">
          Experimentar demonstração →
        </Link>
        <p className="small">
          Dados fictícios. Sem cadastro. As alterações duram apenas esta sessão.
        </p>
        <h2>Quer usar com seus dados?</h2>
        <p>Configure o Supabase local para abrir seu espaço.</p>
        <ol>
          <li>
            Execute <code>supabase start</code>.
          </li>
          <li>
            Copie <code>.env.example</code> para <code>.env.local</code>.
          </li>
          <li>
            Preencha a URL e a chave pública anon de{" "}
            <code>supabase status</code>.
          </li>
          <li>
            Execute <code>npm run dev</code>.
          </li>
        </ol>
      </main>
    );
  if (!ready)
    return (
      <main className="setup">
        <Brand />
        <p role="status">Abrindo seu espaço…</p>
      </main>
    );
  if (!user) return <Auth initialError={error} />;
  return <Dashboard key={user.id} user={user} view={view} />;
}

function Auth({ initialError }: { initialError: string }) {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(initialError);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const data = new FormData(event.currentTarget);
    try {
      const credentials = {
        email: field(data, "email"),
        password: String(data.get("password") ?? ""),
      };
      const response = signup
        ? await supabase!.auth.signUp(credentials)
        : await supabase!.auth.signInWithPassword(credentials);
      checked(response.error);
      if (signup && !response.data.session)
        setNotice(
          "Conta criada. Confira seu e-mail para confirmar o cadastro.",
        );
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <p className="eyebrow">Menos ruído. Mais conversa.</p>
          <h1>
            Um bom negócio
            <br />
            tem uma
            <br />
            <em>linha clara.</em>
          </h1>
          <p>
            Do primeiro contato à próxima conquista.
            <br />
            Leads, tarefas e vendas no mesmo lugar.
          </p>
        </div>
        <span className="edition">01 — SEU ESPAÇO DE TRABALHO</span>
      </section>
      <section className="auth-form">
        <p className="eyebrow">Vamos começar</p>
        <h2>{signup ? "Crie seu espaço." : "Bom ter você aqui."}</h2>
        <p>Entre com seu e-mail e senha.</p>
        <form onSubmit={submit}>
          <label>
            E-mail
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Aguarde…" : signup ? "Criar conta →" : "Entrar →"}
          </button>
        </form>
        <p role="status">{notice}</p>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setSignup(!signup);
            setNotice("");
          }}
        >
          {signup ? "Já tenho uma conta" : "Ainda não tenho conta"}
        </button>
        <p className="small">Cada conta tem seu próprio pipeline.</p>
      </section>
    </main>
  );
}

async function readAll(table: "leads" | "tasks" | "deals" | "commissions") {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase!
      .from(table)
      .select("*")
      .order(table === "commissions" ? "deal_id" : "id")
      .range(from, from + 999);
    checked(error);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

function Dashboard({ user, view }: { user: User; view: View }) {
  const [data, setData] = useState<CrmData>({
    leads: [],
    tasks: [],
    deals: [],
    commissions: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const taskHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (selected) taskHeading.current?.focus();
  }, [selected]);
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    const [leads, tasks, deals, commissions] = await Promise.all([
      readAll("leads"),
      readAll("tasks"),
      readAll("deals"),
      readAll("commissions"),
    ]);
    if (mounted.current)
      setData({
        leads: leads as Lead[],
        tasks: tasks as Task[],
        deals: deals as Deal[],
        commissions: commissions as Commission[],
      });
  }, []);
  useEffect(() => {
    mounted.current = true;
    load()
      .catch((error) => {
        if (mounted.current) setError(message(error));
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
    };
  }, [load]);
  async function run(operation: () => Promise<void>, success: string) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    let saved = false;
    try {
      await operation();
      saved = true;
      await load();
      setNotice(success);
    } catch (error) {
      setError(
        saved
          ? `Alteração salva, mas a atualização falhou. Recarregue a página. ${message(error)}`
          : message(error),
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
    return saved;
  }
  const openLeads = data.leads.filter(
    (lead) => !["ganho", "perdido"].includes(lead.stage),
  );
  const visible = data.leads.filter((lead) =>
    `${lead.name} ${lead.company} ${lead.email}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const activeLead =
    selected && data.leads.find((lead) => lead.id === selected.id);
  return (
    <div className="workspace">
      <header className="topbar">
        <Brand />
        <nav aria-label="Principal">
          <Link
            href="/"
            aria-current={view === "pipeline" ? "page" : undefined}
          >
            Pipeline
          </Link>
          <Link
            href="/vendas"
            aria-current={view === "sales" ? "page" : undefined}
          >
            Vendas
          </Link>
        </nav>
        <div className="account">
          <span>{user.email}</span>
          <button
            disabled={busy}
            onClick={async () => {
              const { error } = await supabase!.auth.signOut();
              if (error) setError(error.message);
            }}
          >
            Sair ↗
          </button>
        </div>
      </header>
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
                ? "Organize o próximo passo. O resto vem da conversa."
                : "Vendas registradas e comissões sem surpresa."}
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
              {money(
                openLeads.reduce((sum, lead) => sum + lead.value_cents, 0),
              )}
            </strong>
            <small>{openLeads.length} oportunidades</small>
          </div>
          <div>
            <span>Vendas registradas</span>
            <strong>
              {money(
                data.deals.reduce((sum, deal) => sum + deal.amount_cents, 0),
              )}
            </strong>
            <small>{data.deals.length} negócios fechados</small>
          </div>
          <div>
            <span>Comissões</span>
            <strong>
              {money(
                data.commissions.reduce(
                  (sum, item) => sum + item.amount_cents,
                  0,
                ),
              )}
            </strong>
            <small>Percentual fixado em cada venda</small>
          </div>
          <div>
            <span>Próximos passos</span>
            <strong>
              {data.tasks
                .filter((task) => !task.done)
                .length.toString()
                .padStart(2, "0")}
            </strong>
            <small>Tarefas em aberto</small>
          </div>
        </div>
        {error && (
          <p role="alert" className="alert">
            {error}{" "}
            <button
              disabled={busy}
              onClick={() => void run(async () => {}, "Dados atualizados.")}
            >
              Tentar atualizar
            </button>
          </p>
        )}
        <p role="status" className="status">
          {busy ? "Salvando…" : notice}
        </p>
        {loading ? (
          <p role="status">Carregando seu pipeline…</p>
        ) : view === "pipeline" ? (
          <>
            <div className="toolbar">
              <label className="search">
                <span className="sr-only">Buscar leads</span>
                <input
                  placeholder="Buscar pessoa ou empresa…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <span className="small">Arraste um card ou escolha a etapa.</span>
              {data.leads.length === 0 && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const { error } = await supabase!.rpc("seed_demo");
                      checked(error);
                    }, "Demonstração carregada. Todos os nomes são fictícios.")
                  }
                >
                  Carregar demonstração
                </button>
              )}
            </div>
            <details className="composer">
              <summary>+ Novo lead</summary>
              <form
                className="inline-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const values = new FormData(form);
                  const saved = await run(async () => {
                    const { error } = await supabase!.from("leads").insert({
                      name: field(values, "name"),
                      company: field(values, "company"),
                      email: field(values, "email"),
                      value_cents: decimalToInteger(
                        field(values, "value"),
                        MAX_CENTS,
                      ),
                    });
                    checked(error);
                  }, "Lead adicionado.");
                  if (saved) form.reset();
                }}
              >
                <label>
                  Nome
                  <input name="name" required maxLength={100} />
                </label>
                <label>
                  Empresa
                  <input name="company" maxLength={100} />
                </label>
                <label>
                  E-mail
                  <input name="email" type="email" maxLength={254} />
                </label>
                <label>
                  Valor estimado (R$)
                  <input
                    name="value"
                    inputMode="decimal"
                    defaultValue="0"
                    required
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Adicionar lead
                </button>
              </form>
            </details>
            <Board
              leads={visible}
              tasks={data.tasks}
              busy={busy}
              onSelect={setSelected}
              onMove={(id, stage) =>
                void run(async () => {
                  const { error } = await supabase!
                    .from("leads")
                    .update({ stage })
                    .eq("id", id)
                    .select("id")
                    .single();
                  checked(error);
                }, "Etapa atualizada.")
              }
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
                    <p>{activeLead.email || "Sem e-mail cadastrado"}</p>
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
                            disabled={busy}
                            onChange={() =>
                              void run(async () => {
                                const { error } = await supabase!
                                  .from("tasks")
                                  .update({ done: !task.done })
                                  .eq("id", task.id)
                                  .select("id")
                                  .single();
                                checked(error);
                              }, "Tarefa atualizada.")
                            }
                          />
                          <span className={task.done ? "done" : ""}>
                            {task.title}
                          </span>
                        </label>
                        {task.due_date && (
                          <time dateTime={task.due_date}>
                            {task.due_date.split("-").reverse().join("/")}
                          </time>
                        )}
                      </li>
                    ))}
                </ul>
                <form
                  className="inline-form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const values = new FormData(form);
                    const saved = await run(async () => {
                      const { error } = await supabase!.from("tasks").insert({
                        lead_id: activeLead.id,
                        title: field(values, "title"),
                        due_date: field(values, "due_date") || null,
                      });
                      checked(error);
                    }, "Tarefa adicionada.");
                    if (saved) form.reset();
                  }}
                >
                  <label>
                    Tarefa
                    <input name="title" required maxLength={200} />
                  </label>
                  <label>
                    Prazo (opcional)
                    <input name="due_date" type="date" />
                  </label>
                  <button className="primary" disabled={busy}>
                    Adicionar tarefa
                  </button>
                </form>
              </section>
            )}
          </>
        ) : (
          <Sales
            data={data}
            busy={busy}
            onCreate={(sale) =>
              run(async () => {
                const { error } = await supabase!.from("deals").insert(sale);
                checked(error);
              }, "Venda e comissão registradas.")
            }
          />
        )}
        <footer>
          Linha / CRM starter<span>Um próximo passo de cada vez.</span>
        </footer>
      </main>
    </div>
  );
}
