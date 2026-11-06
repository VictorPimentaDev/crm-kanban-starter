import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

// Requires agent-browser and its Chromium installation; no app dependency.
const url = new URL(process.argv[2] ?? "http://127.0.0.1:3107/demo");
assert(["127.0.0.1", "localhost", "crm-kanban-starter.vercel.app"].includes(url.hostname));
assert.equal(url.pathname, "/demo");
const origin = url.hostname.endsWith("vercel.app") ? "public" : "local";
const session = `crm-demo-check-${process.pid}`;
mkdirSync("docs/demo", { recursive: true });
function browser(...args) {
  return execFileSync("agent-browser", ["--session", session, ...args], {
    encoding: "utf8", timeout: 40_000, stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
function read(expression) {
  const response = JSON.parse(browser("--json", "eval", expression));
  assert.equal(response.success, true);
  return response.data.result;
}
const wait = (expression) => browser("wait", "--fn", expression);
const button = (name) => browser("find", "role", "button", "click", "--name", name);
const fill = (name, value) => browser("find", "label", name, "fill", value);
const stage = 'document.querySelector("#stage-marina")?.value';
const rows = 'document.querySelectorAll("tbody tr").length';
const layoutFailures = [];
function fits() {
  const dimensions = read("({page: document.documentElement.scrollWidth, viewport: innerWidth})");
  if (dimensions.page > dimensions.viewport) layoutFailures.push(dimensions);
}
function capture(viewport, state) {
  browser("screenshot", "--full", `docs/demo/${origin}-${viewport}-${state}.png`);
}

try {
  for (const viewport of ["desktop", "mobile"]) {
    browser("open", url.href);
    if (viewport === "mobile") browser("set", "viewport", "390", "844");
    else browser("set", "viewport", "1440", "1000");
    wait(`${stage} === 'novo'`);
    // A restore action also proves hydration completed before the first mutation.
    button("Restaurar demonstração");
    browser("wait", "--text", "Demonstração restaurada.");
    const storageBefore = read("JSON.stringify({local: {...localStorage}, session: {...sessionStorage}, cookie: document.cookie})");
    browser("eval", "performance.clearResourceTimings()");
    fits();
    capture(viewport, "pipeline");
    if (viewport === "desktop") {
      browser("drag", ".stage-novo .lead-card", ".stage-qualificado");
      wait(`${stage} === 'qualificado'`);
    }
    browser("select", "#stage-marina", "ganho");
    wait(`${stage} === 'ganho'`);
    button("Vendas");
    wait(`${rows} === 1`);
    assert.equal(read(rows), 1, "moving to Ganho must not create revenue");
    button("Pipeline");
    wait(`${stage} === 'ganho'`);
    browser("scrollintoview", "article:has(#stage-marina) .lead-name");
    button("Marina Exemplo");
    browser("wait", "--text", "Agendar conversa inicial");
    assert.equal(read("document.activeElement.textContent"), "Marina Exemplo");
    fill("Tarefa", "Enviar proposta fictícia QA");
    button("Adicionar tarefa");
    wait('document.querySelectorAll(".task-list input").length === 3');
    browser("check", ".task-list li:last-child input");
    wait('document.querySelector(".task-list li:last-child input").checked');
    fits();
    button("Vendas");
    browser("wait", "--text", "Negócio fechado?");
    browser("select", 'select[name="lead_id"]', "marina");
    fill("Venda (R$)", "100,05");
    fill("Comissão (%)", "100.01");
    button("Registrar venda →");
    browser("wait", "--text", "Valor acima do limite permitido.");
    assert.equal(read(rows), 1);
    fill("Comissão (%)", "10");
    wait('document.querySelector(".commission-preview strong").textContent.includes("10,01")');
    button("Registrar venda →");
    wait(`${rows} === 2`);
    assert.match(read('Array.from(document.querySelectorAll("tbody tr")).find(row => row.textContent.includes("Marina Exemplo")).lastElementChild.textContent'), /10,01/);
    assert.equal(read('document.querySelector("option[value=marina]") === null'), true);
    fits();
    capture(viewport, "sales");
    assert.equal(read("JSON.stringify({local: {...localStorage}, session: {...sessionStorage}, cookie: document.cookie})"), storageBefore);
    assert.deepEqual(read("performance.getEntriesByType('resource').filter(e => ['fetch','xmlhttprequest'].includes(e.initiatorType)).map(e => e.name)"), [], "demo interactions must not make API requests");
    button("Restaurar demonstração");
    wait(`${stage} === 'novo'`);
    button("Marina Exemplo");
    wait('document.querySelectorAll(".task-list input").length === 2');
    button("Vendas");
    wait(`${rows} === 1`);
    button("Pipeline");
    wait(`${stage} === 'novo'`);
    browser("select", "#stage-marina", "perdido");
    wait(`${stage} === 'perdido'`);
    browser("reload");
    wait(`${stage} === 'novo'`);
    process.stdout.write(`PASS ${origin} ${viewport}: move, task, validation, rounding, duplicate exclusion, reset, reload, storage, network\n`);
  }
  assert.deepEqual(layoutFailures, [], "page must fit viewport; board/table may scroll inside their containers");
  process.stdout.write(`PASS ${origin}: desktop/mobile layout\n`);
} catch (error) {
  browser("screenshot", "--full", `/tmp/${session}-failure.png`);
  process.stderr.write(browser("snapshot", "-i") + "\n");
  throw error;
} finally {
  browser("close");
}
