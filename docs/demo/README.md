# Verificação da demo e do Supabase local

Verificado em **06/11/2026**, a partir do checkpoint `618ba3e`, na branch
`portfolio/demo-regression-f8306abd`. Repositório público por decisão do Victor;
nenhuma configuração de visibilidade foi alterada por este trabalho.

**Correção pronta para revisão.** Os fluxos locais passaram. A demo pública
continua em <https://crm-kanban-starter.vercel.app/demo>, sem promoção de produção, e ainda
apresenta o overflow mobile descrito abaixo. Os **8 alertas moderados de lint
continuam abertos**, sem atualização estável compatível disponível nesta data.

## Defeito reproduzido e correção

Em 390 × 844, a página do pipeline publicada tem `scrollWidth = 1030`, embora
`innerWidth = 390`. Os labels `.sr-only` dos seletores são posicionados de forma
absoluta e escapam do contêiner de rolagem do board. Isso cria uma faixa vazia à
direita da página. A captura [antes](public-mobile-pipeline.png) mostra o problema.

Adicionar `position: relative` a `.lead-card` mantém esses labels dentro do card.
O board e a tabela continuam rolando horizontalmente dentro de seus contêineres;
a página local passa a ter largura de 390 px. Os nomes acessíveis e o foco do
painel de tarefas foram preservados. A mesma regra atende `Demo` e `Workspace`.
Não houve alteração de schema, API, regras de dinheiro ou dependências.

| Evidência após a correção | Desktop 1440 × 1000 | Mobile 390 × 844 |
| --- | --- | --- |
| Demo: pipeline | [captura](local-desktop-pipeline.png) | [captura](local-mobile-pipeline.png) |
| Demo: venda | [captura](local-desktop-sales.png) | [captura](local-mobile-sales.png) |
| Conta local: tarefa com prazo | [captura](auth-desktop-tasks.png) | [captura](auth-mobile-tasks.png) |
| Conta local: venda persistida | [captura](auth-desktop-sales.png) | [captura](auth-mobile-sales.png) |

As capturas são reais, sem edição, com nomes e contas fictícios `example.com`.
O histórico mobile exige rolagem horizontal para ver a coluna de comissão;
o teste também verifica o valor no DOM, mesmo fora da área visível da tabela.

## Gates e resultados

Ambiente: macOS arm64, Node **24.14.1**, npm **11.11.0**, agent-browser **0.31.1**
com Chromium, Supabase CLI **2.111.0**, PostgreSQL 17 em Colima isolado.

| Comando | Resultado |
| --- | --- |
| `npm ci` | exit 0; instalação pelo lockfile; 8 moderados reportados |
| `npm run lint` | exit 0, sem erros |
| `npm run typecheck` | exit 0, `Types generated successfully` |
| `npm test` | exit 0, **4 arquivos / 46 testes passaram**; base tinha 44 |
| `npm run build` | exit 0, compilou e gerou `/`, `/demo`, `/vendas` e `/_not-found` |
| `node docs/demo/check-demo.mjs` | exit 0, desktop/mobile: fluxos e layout |
| `node docs/demo/check-demo.mjs https://crm-kanban-starter.vercel.app/demo` | exit 1 **esperado no deploy atual**: fluxos passaram; duas verificações de layout mobile encontraram 1030 > 390 |
| `node docs/demo/check-auth.mjs` | exit 0, desktop/mobile autenticados com duas contas novas |
| `psql -v ON_ERROR_STOP=1 -f supabase/tests/ownership.sql` | exit 0, executado via `docker exec -i`, termina em `ROLLBACK` |
| `npm audit --json` | exit 1, 8 moderados exclusivamente na cadeia dev do lint |
| `npm audit --omit=dev --json` | exit 0, **0 vulnerabilidades** |
| `npm audit fix --dry-run --json` | 0 pacotes adicionados, alterados ou removidos; 8 moderados permanecem |

Saídas relevantes:

```text
Test Files  4 passed (4)
     Tests  46 passed (46)
PASS local desktop: move, task, validation, rounding, duplicate exclusion, reset, reload, storage, network
PASS local mobile: move, task, validation, rounding, duplicate exclusion, reset, reload, storage, network
PASS local: desktop/mobile layout
PASS public desktop: move, task, validation, rounding, duplicate exclusion, reset, reload, storage, network
PASS public mobile: move, task, validation, rounding, duplicate exclusion, reset, reload, storage, network
AssertionError: page must fit viewport; board/table may scroll inside their containers
actual: [ { page: 1030, viewport: 390 }, { page: 1030, viewport: 390 } ]
PASS auth desktop: signup, empty account, seed, lead/search, stage, dated task, commission, reload, demo isolation, signout/signin, layout
PASS auth mobile: signup, empty account, seed, lead/search, stage, dated task, commission, reload, demo isolation, signout/signin, layout
ownership, commission rounding, immutability and demo isolation: OK
```

Os dois testes Vitest novos cobrem a separação entre mover para Ganho e registrar
receita, e a perda das alterações da demo ao desmontar/remontar a página. Os
roteiros de navegador fazem assertions de estado, sem mocks de Auth/PostgREST.

## Reproduzir

Use Node 24 e agent-browser com Chromium instalado. Os roteiros são opt-in:
o CI existente continua executando lint, typecheck, Vitest e build; não passa a
depender de um navegador global ou de Docker.

Para a demo sem backend, sem `.env.local`:

```bash
npm ci
npm run build
npm run start -- --hostname 127.0.0.1 --port 3107
# Em outro terminal, na mesma pasta:
node docs/demo/check-demo.mjs
```

O roteiro abre uma sessão exclusiva, arrasta um card no desktop, usa o seletor
nos dois tamanhos, cria/conclui tarefa, rejeita comissão acima de 100%, registra
R$100,05 a 10% e confere R$10,01. Confere exclusão do lead vendido do formulário,
restauração, recarga, storage/cookies inalterados e nenhuma chamada fetch/XHR
durante as operações. As capturas são sobrescritas ao executar novamente.

Para o fluxo autenticado, use **somente um banco local descartável**. O roteiro
cria duas contas de QA e seus registros; não apaga contas de um banco existente.

```bash
supabase start
# Configure .env.local conforme o README da raiz, com URL 127.0.0.1:54321
# e a chave pública anon local. Não use um projeto hospedado.
npm run dev -- --hostname 127.0.0.1 --port 3108
# Em outro terminal:
node docs/demo/check-auth.mjs
```

O roteiro recusa configuração diferente de `http://127.0.0.1:54321`, gera senha
aleatória em memória e usa cadastro/login pela UI. Cada conta começa vazia,
carrega seu seed, cria um lead, pesquisa, muda etapa, conclui tarefa com prazo,
registra venda e confere persistência após recarga e novo login. Abrir/restaurar
`/demo` durante a sessão autenticada não altera seus seis leads nem sua tarefa.
O teste SQL complementa isso com ataques de vínculo entre donos e acesso anônimo.

Nesta execução, a stack foi criada no perfil Colima exclusivo `crm-f8306abd`,
sem ativá-lo como contexto Docker global. API/Auth/PostgREST/banco reais foram
usados; Studio, Storage, Realtime, Edge Runtime, analytics e pooler foram
excluídos do start. Nenhuma dessas funções é usada pelo starter. Servidores,
browser e stack foram encerrados; volumes de QA permaneceram no perfil parado.

## Auditoria das dependências

Os oito alertas são propagação de
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), uma possível
negação de serviço no processamento de glob patterns em `minimatch`.
Pacotes afetados no lock: `minimatch`, `typescript-eslint`,
`@typescript-eslint/{eslint-plugin,parser,type-utils,typescript-estree,utils}` e
`eslint-config-next`. Evidência integral: [audit.json](audit.json).

Na consulta ao registro npm, `eslint-config-next@16.4.5` e
`typescript-eslint@8.72.1` já eram as versões estáveis atuais. O último
`@typescript-eslint/typescript-estree@8.72.1` ainda exige `minimatch ^10.2.2`;
a versão instalada é **10.2.6**, a última publicada na major 10. O advisory só
declara correção em **11.0.1**, fora dessa faixa.

O audit sugere downgrade de `eslint-config-next` para 15.5.29, marcado como
mudança major; não é uma atualização compatível do lint de Next 16. Não foram
aplicados downgrade, override de major, canary, `--force`, supressão de auditoria
ou alteração das regras de lint. Reavaliar quando typescript-eslint incorporar
a correção. O audit de produção zerado não elimina o risco das ferramentas dev.

## Varredura antes do push

Gitleaks **8.30.1**, sem allowlist, baseline ou supressões:

```bash
gitleaks git --redact=100 --no-banner --log-opts='--all' .
gitleaks dir --redact=100 --no-banner .
```

Histórico: `no leaks found`. A primeira varredura do diretório encontrou 15
ocorrências exclusivamente no cache `.next` (chaves efêmeras geradas pelo Next e
chave anon local nos bundles de desenvolvimento). Depois de encerrar os
servidores e remover esse cache regenerável, a varredura completa retornou
`no leaks found`. `.env.local` temporário foi removido. Nenhum achado foi
ignorado; histórico não foi reescrito. Os scans são repetidos no HEAD final
imediatamente antes do push. Arquivos de agente permanecem fora do índice Git.

## Limitações e pontos para conferir

- A URL principal ainda tem o defeito mobile. Após o primeiro push, a integração
  Git existente criou automaticamente um preview de `28df50b`, registrado pelo bot
  Vercel no PR. Não houve comando de deploy nem promoção de produção. Isso foi
  um efeito indesejado do push autorizado e foi informado ao Victor.
  `vercel.json` agora desativa autodeploy **somente** da branch
  `portfolio/demo-regression-f8306abd`, conforme a
  [configuração oficial](https://vercel.com/docs/project-configuration/git-configuration).
  Main e demais branches mantêm seu comportamento; o preview já criado não foi
  promovido ou removido. Esse arquivo é a única mudança além da correção/UI/QA,
  necessária para impedir outro preview ao enviar a nota corrigida.
- Mobile significa viewport Chromium 390 × 844, sem aparelho nativo, Safari,
  teclado virtual ou gesto de arraste por toque. O seletor alternativo foi usado.
- O preenchimento de data nativa de agent-browser 0.31.1 deixou o campo vazio.
  O roteiro atribui o valor DOM e emite input/change antes do submit normal;
  valida a data renderizada após a persistência, sem alegar teste do datepicker.
- A primeira tentativa Colima sem mount da worktree falhou com
  `pgsodium_root.key: Is a directory` / `FATAL: invalid secret key`. Montar apenas
  esta worktree no perfil isolado resolveu; não foi falha do schema.
- O conector GitHub não tinha acesso ao repo; foi usado o `gh` autenticado.
- As credenciais locais não foram versionadas. Não houve acesso a produção,
  integração WhatsApp, envio de e-mail externo, migração remota ou deploy manual.
- Revisar as capturas, a rolagem interna do board/tabela e os oito alertas dev
  antes de qualquer publicação futura. O link do demo foi preservado.
