import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";

// Run only against a disposable local Supabase stack and its local dev server.
process.loadEnvFile(".env.local");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
const base = "http://127.0.0.1:3108";
const session = `crm-auth-check-${process.pid}`;
const run = randomUUID().slice(0, 8);
const password = randomUUID();
mkdirSync("docs/demo", { recursive: true });
function browser(...args) {
  try {
    return execFileSync("agent-browser", ["--session", session, ...args], {
      encoding: "utf8", timeout: 40_000, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const detail = String(error.stderr ?? "").replaceAll(password, "[omitted]");
    throw new Error(`Browser command failed: ${args[0]}: ${detail}`);
  }
}
function read(expression) {
  const response = JSON.parse(browser("--json", "eval", expression));
  assert.equal(response.success, true);
  return response.data.result;
}
const wait = (expression) => browser("wait", "--fn", expression);
const text = (value) => browser("wait", "--text", value);
const button = (name) => browser("find", "role", "button", "click", "--name", name);
const fill = (name, value) => browser("find", "label", name, "fill", value);
const sales = () => browser("click", 'nav a[href="/vendas"]');
const cardCount = 'document.querySelectorAll(".lead-card").length';
const rowCount = 'document.querySelectorAll("tbody tr").length';
function fits() {
  assert.equal(read("document.documentElement.scrollWidth <= innerWidth"), true);
}

try {
  for (const viewport of ["desktop", "mobile"]) {
    const email = `qa-${run}-${viewport}@example.com`;
    const name = `QA ${viewport}`;
    browser("open", base);
    browser("set", "viewport", viewport === "desktop" ? "1440" : "390", viewport === "desktop" ? "1000" : "844");
    text("Bom ter você aqui.");
    fits();
    button("Ainda não tenho conta");
    fill("E-mail", email);
    fill("Senha", password);
    button("Criar conta →");
    text("Carregar demonstração");
    assert.equal(read(cardCount), 0, "a new account must not see the other account's leads");
    button("Carregar demonstração");
    wait(`${cardCount} === 5`);
    browser("click", ".composer summary");
    fill("Nome", name);
    fill("Empresa", "Empresa fictícia QA");
    fill("E-mail", `${viewport}@example.com`);
    fill("Valor estimado (R$)", "100,05");
    button("Adicionar lead");
    wait(`${cardCount} === 6`);
    fill("Buscar leads", name);
    wait(`${cardCount} === 1`);
    const stageSelector = read('"#" + document.querySelector(".lead-card select").id');
    browser("select", stageSelector, "proposta");
    text("Etapa atualizada.");
    button(name);
    wait('document.querySelector(".task-panel h2") !== null');
    assert.equal(read("document.activeElement.textContent"), name);
    fill("Tarefa", "Conferir proposta fictícia");
    // shortcut: CLI 0.31.1 leaves dates empty; use native fill when it supports date inputs.
    browser("eval", `{
      const input = document.querySelector('input[name="due_date"]');
      input.value = '2026-11-10';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }`);
    assert.equal(read('document.querySelector("input[name=due_date]").value'), "2026-11-10");
    button("Adicionar tarefa");
    wait('document.querySelectorAll(".task-list input").length === 1');
    browser("check", ".task-list input");
    text("Tarefa atualizada.");
    assert.equal(read('document.querySelector(".task-list time").dateTime'), "2026-11-10");
    fits();
    browser("screenshot", "--full", `docs/demo/auth-${viewport}-tasks.png`);
    sales();
    text("Negócio fechado?");
    wait(`${rowCount} === 1`);
    const leadId = read(`Array.from(document.querySelectorAll('select[name="lead_id"] option')).find(o => o.textContent.includes(${JSON.stringify(name)})).value`);
    browser("select", 'select[name="lead_id"]', leadId);
    fill("Venda (R$)", "100,05");
    fill("Comissão (%)", "10");
    button("Registrar venda →");
    text("Venda e comissão registradas.");
    wait(`${rowCount} === 2`);
    browser("reload");
    wait(`${rowCount} === 2`);
    assert.match(read(`Array.from(document.querySelectorAll('tbody tr')).find(r => r.textContent.includes(${JSON.stringify(name)})).lastElementChild.textContent`), /10,01/);
    assert.equal(read(`document.querySelector('option[value="${leadId}"]') === null`), true);
    fits();
    browser("screenshot", "--full", `docs/demo/auth-${viewport}-sales.png`);
    browser("open", `${base}/demo`);
    text("Restaurar demonstração");
    button("Restaurar demonstração");
    browser("open", base);
    wait(`${cardCount} === 6`);
    button(name);
    wait('document.querySelector(".task-list input")?.checked === true');
    assert.equal(read(`document.querySelector(${JSON.stringify(stageSelector)}).value`), "ganho");
    button("Sair ↗");
    text("Bom ter você aqui.");
    fill("E-mail", email);
    fill("Senha", password);
    button("Entrar →");
    wait(`${cardCount} === 6`);
    button("Sair ↗");
    text("Bom ter você aqui.");
    process.stdout.write(`PASS auth ${viewport}: signup, empty account, seed, lead/search, stage, dated task, commission, reload, demo isolation, signout/signin, layout (${email})\n`);
  }
} catch (error) {
  browser("screenshot", "--full", `/tmp/${session}-failure.png`);
  process.stderr.write(browser("snapshot", "-i") + "\n");
  throw error;
} finally {
  browser("close");
}
