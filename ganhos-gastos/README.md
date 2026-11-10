# Ganhos & Gastos — App Desktop

Aplicativo desktop de controle financeiro construído com **Electron + React + TypeScript + Vite**,
consumindo a API web do Google Apps Script da planilha "Ganhos & Gastos" para
lançamentos, salário e extras. Não há dados fictícios: sem dados na API, o app
mostra estados vazios.

Além disso, o app inclui três áreas **100% locais** (Hora Extra, Férias e
Manutenção de Veículo) que **não dependem da API**: os registros são gravados em
`userData/dados-locais.json` e continuam funcionando mesmo com a API
indisponível ou protegida por login.

---

## 1. Requisitos

- Node.js 18.19+ (testado com Node 18.19.1 / npm 9.2)
- Linux, macOS ou Windows (no Linux é preciso ter um X11/Wayland disponível)
- Acessos à URL de implantação do Apps Script (ver `.env.example`)

---

## 2. Configuração

```bash
cd ganhos-gastos
cp .env.example .env
```

Edite `.env`:

| Variável   | Descrição                                                                 |
|------------|---------------------------------------------------------------------------|
| `BASE_URL` | URL de produção do web app do Google Apps Script (termina em `/exec`).     |
| `API_KEY`  | Chave da API (`Config.gs → API_KEY`). Deixe **vazio** se a API não usar chave — nesse caso o parâmetro é omitido das chamadas. |

> A chave **nunca** entra no bundle do renderer: ela é lida pelo processo principal
> em tempo de execução (arquivo `.env` ou variáveis de ambiente do sistema).

---

## 3. Rodando

```bash
npm install          # instala dependências
npm run dev          # desenvolvimento (Vite + Electron com hot reload)
npm run build        # typecheck + build de produção (main, preload e renderer em out/)
npm start            # roda a build de produção
npm run typecheck    # só o verificador de tipos (tsc --noEmit)
```

### Diagnóstico

```bash
DEBUG_RENDERER=1 npm run dev     # espelha o console do renderer no terminal
ELECTRON_ENABLE_GPU=1 npm run dev  # reativa aceleração por GPU (desligada por padrão)
```

> **Nota (GPU):** por padrão o app adiciona os switches `disable-gpu`,
> `in-process-gpu` e `disable-gpu-sandbox`, porque em máquinas/VMs sem GPU o
> processo de GPU do Chromium pode encerrar o app (`GPU process isn't usable`).
> A renderização por software é mais que suficiente para este app.

---

## 4. Como funciona a API

- **Leituras (GET)** — `?acao=ano&ano=YYYY` é o endpoint principal: um snapshot
  completo do ano (12 meses com registros, salário, extras e resumo do dashboard)
  em uma única chamada. Também existem `acao=abas`, `acao=listas`,
  `acao=dashboard` e `acao=listar`.
- **Escritas (POST)** — JSON com `Content-Type: text/plain;charset=utf-8`
  (evita preflight CORS): `adicionar`, `editar`, `remover`, `criarAno`,
  `atualizarDashboard`. Na aba **Extras** é obrigatório o campo `tabela`
  (`ganhos` | `gastos`). Identificar registro: campo `linha`.
- Todas as requisições HTTP acontecem **no processo main** do Electron
  (`src/main/http.ts`) e chegam ao renderer via IPC (`contextBridge`), sem CORS.
- **Timeout de 60s** (a 1ª chamada após inatividade pode levar ~30s — cold start
  do Apps Script) e retry com backoff exponencial. Escritas só são repetidas em
  erro `LOCK` (nesse caso a escrita não foi aplicada — repetir é seguro; repetir
  após falha de rede poderia duplicar registros).
- Erros como `sucesso:false` viram toast e a UI continua utilizável.

### ⚠️ Acesso público da implantação

Se a implantação do Apps Script estiver com "Quem tem acesso: Somente eu",
o Google redireciona para a página de login e o app mostra:

> "A API exigiu login do Google. A implantação do Apps Script precisa estar com
> *Quem tem acesso: Qualquer pessoa* (Implantar → Gerenciar implantações)."

Para liberar: no editor do Google Apps Script → **Implantar → Gerenciar
implantações → ✏️ → Implantação: Aplicativo da Web → Quem tem acesso: Qualquer
pessoa → Implantar** (gere um novo URL de implantação se necessário e atualize
`BASE_URL`).

---

## 5. Áreas do app

| Área | Descrição |
|------|-----------|
| **Dashboard** | Indicadores do ano (total, mês, maior categoria, média, saldo), pizza por CATEGORIA e colunas por MÊS usando os agregados da API (`resumo`), seletor de ano global, ranking de categorias. **Novidade:** exportação CSV dos lançamentos do mês selecionado, impressão PDF (janela de impressão do sistema), seção de divisão com Lívia (Total Gasto / Recebo Livia / Total Real), ranking de gastos apenas de "Eu" e ranking por tipo de pagamento (Fatura futura / Pix / Boleto-débito com quanto é de "Eu"). |
| **Lançamentos** | Lista do mês (seletor JAN..DEZ), busca por texto + filtros CATEGORIA / TIPO / FORMA DE PGTO / QUEM PAGA / faixa de DATA — todos locais sobre o cache, com debounce de 200 ms. CRUD completo (edição/exclusão usa o `linha` da listagem). Total filtrado em tempo real. Acima de 200 linhas a tabela é virtualizada (`react-window`). **Novidade:** coluna Observação com largura limitada e tooltip "janela" ao passar o mouse (conteúdo completo), edição inline da Observação (clique para editar, Enter/sai para salvar), colunas com largura dinâmica proporcional ao conteúdo e rodapé com Total Gasto / Recebo Livia / Total Real. |
| **Quadro de Pagamentos** | Kanban com uma coluna por TIPO (@dnd-kit) + coluna **Despesas Livia** (primeira, espelho somente-leitura de todos os lançamentos 'Dividido 50/50' e 'Livia'). Arrastar um cartão entre colunas altera o TIPO do lançamento (escrita otimista + rollback em falha). Cartões-resumo acima do quadro com Total Gasto / Meu gasto Real / Gasto Livia e rodapé com os mesmos totais. |
| **Pagamentos** | **Nova aba.** Resumo mensal por linha (mês a mês): Salário mês (Total Ganhos da aba Ganhos) − Despesas mês anterior (Meu gasto real do mês anterior, da aba Lançamentos) = Restante. Coluna Saldo = Saldo em caixa (digitado pelo usuário) + Restante. Para o 1º mês do ano (sem mês anterior na planilha) há campo manual para informar as despesas do mês anterior. Campos digitados persistem em `localStorage`. Área informativa do Pix do mês anterior (já incluído no Meu gasto real, reposição já embutida no Restante). |
| **Ganhos** | Aba **Salário**: edição apenas das colunas editáveis (SALÁRIO BASE, 13º, FÉRIAS, AJUDA CUSTO, HORA EXTRA, OUTROS, TICKET, OBSERVAÇÃO) — FREELANCE, TOTAL SALÁRIO e TOTAL GANHOS nunca são enviadas. Aba **Extras**: sub-abas Ganhos/Gastos com CRUD completo, sempre enviando `tabela`. |
| **Horas Extras** 🔒 | Registra cada plantão (chegada, início/fim do almoço, saída da empresa, fim do plantão, data, observação). O cálculo é ao vivo no formulário. Dashboard com total, KPIs de 100% × 50%, barras empilhadas por mês, pizza de composição, filtro por mês e tabela com editar/excluir. |
| **Férias** 🔒 | Período aquisitivo **fixo Abril → Abril**, derivado automaticamente da data de início. Escolha de 30 / 20 / 15 dias (abono automático e limitado a 10), fim calculado, valor calculado do salário bruto (férias + 1/3 constitucional e abono), saldo por período e observação. |
| **Manutenção de Veículo** 🔒 | Descrição, data, KM no momento, valor, mecânica/loja, loja de peças e observação. O app calcula a **próxima revisão por data e por KM** e o **status** (URGENTE / PRÓXIMO / OK) usando o **KM atual** configurado na página. Presets de revisão (óleo, freios, correia…), busca, filtro por status e ordenação. |
| **Gestão de Anos** | Lista os anos (`acao=abas`), cria ano novo (`criarAno`) e oferece a geração do Dashboard daquele ano (`atualizarDashboard`). |

> 🔒 = áreas **locais**: os dados nunca saem do computador (arquivo
> `userData/dados-locais.json`), independem da API do Apps Script e não são
> sincronizados com a planilha.

### Cálculos das áreas locais

As fórmulas reproduzem a planilha "Ganhos & Gastos" (`src/renderer/lib/calculos.ts`):

- **Hora extra**: `valorHora = salárioBruto ÷ 220` (44 h/semana, CLT).
  - **100%** = `(saídaEmpresa − chegada) − (almoçoFim − almoçoInício)`, multiplicado por `valorHora × 2`;
  - **50%** = `fimPlantão − saídaEmpresa`, multiplicado por `valorHora × 1,5`.
  - Vírula de madrugada é tratada (+24 h). O painel de configuração exibe o valor da hora derivado.
- **Férias**: `diária = salárioBruto ÷ 30`.
  - Férias gozadas = `dias × diária × 4/3` (1/3 constitucional);
  - Abono (dias vendidos, máx. 10 por lei) = `dias × diária` (sem o 1/3);
  - Período aquisitivo: início em mês ≥ Abril pertence ao período do próprio ano; antes de Abril, ao ano anterior (`Abril/AAAA − Abril/AAAA+1`).
- **Manutenção**: `próximaData = data + intervalo (meses)` e `próximoKM = km + intervalo (km)`.
  - **URGENTE** se `próximaData ≤ hoje` ou `próximoKM ≤ KM atual`;
  - **PRÓXIMO** se `próximaData ≤ hoje + 30 dias` ou `próximoKM ≤ KM atual + 1.000`;
  - **OK** caso contrário.

### Atalhos de teclado

| Atalho | Ação |
|--------|------|
| `Ctrl/Cmd + N` | Novo lançamento (no mês selecionado) |
| `Ctrl/Cmd + F` ou `/` | Ir para Lançamentos com a busca focada |
| `Esc` | Fechar modal |

---

## 6. Performance (arquitetura)

- **Nenhum `fetch` ao montar uma aba.** Trocar de área/mês/filtro é instantâneo,
  sempre a partir do cache.
- **Cache por ano no Zustand** (`src/renderer/store/storeAno.ts`): UMA chamada
  `acao=ano` por ano; todas as áreas leem desse cache.
- **Stale-while-revalidate**: dados em cache aparecem na hora; a requisição de
  atualização roda em segundo plano com um indicador sutil (nunca loading
  bloqueante com dados na tela).
- **Cache persistido em disco** (`userData/cache-ganhos-gastos.json`, gravado
  pelo processo main com debounce e escrita atômica) — a abertura do app já
  mostra os dados e atualiza em background.
- **Atualização otimista**: adicionar/editar/remover muda o estado local na hora;
  em falha, o estado é revertido e um toast explica o erro.
- **Escritas serializadas** em fila no processo main (evita erro `LOCK` na
  planilha); leituras em paralelo.
- **Totais memoizados** (`useMemo`), lista virtualizada acima de 200 linhas,
  componentes de linha memoizados.
- **Loading bloqueante apenas** na primeira abertura sem cache em disco.
- **Indicador global de status da API** no topo (sincronizando / sincronizado /
  sem conexão) + botão de revalidação manual.

---

## 7. Estrutura

```
ganhos-gastos/
├── .env.example            # modelo de configuração (BASE_URL, API_KEY)
├── index.html              # HTML do renderer (CSP restritiva)
├── vite.config.ts          # build do renderer + main + preload
├── src/
│   ├── types/
│   │   ├── api-types.ts     # contrato EXATO da API (não modificar)
│   │   ├── api-electron.ts  # contrato IPC/cache compartilhado
│   │   └── dados-locais.ts  # contrato das áreas locais (HE, férias, manutenção)
│   ├── main/                # processo principal
│   │   ├── index.ts         # janela, switches GPU, logging
│   │   ├── config.ts        # leitura de .env em runtime
│   │   ├── http.ts          # GET/POST, timeout 60s, retry/backoff, redirects
│   │   ├── fila.ts          # fila sequencial de escritas (anti-LOCK)
│   │   ├── cacheStore.ts    # persistência do cache em disco
│   │   ├── localStore.ts    # persistência dos dados locais em disco
│   │   └── ipc.ts           # handlers IPC (nunca rejeitam; retornam {sucesso:false})
│   ├── preload/
│   │   └── index.ts         # contextBridge → window.api
│   └── renderer/
│       ├── components/      # Layout, Modal, Campos, Botoes, Estados, Toasts, StatusApi, ConfigSalario…
│       ├── features/        # dashboard, lancamentos, kanban, pagamentos, ganhos, horasextras, ferias, manutencao, anos
│       ├── store/           # Zustand: storeAno (cache), storeLocal (dados locais) e storeUI (filtros/toasts)
│       ├── services/api.ts  # camada que fala com window.api
│       ├── hooks/           # useDebounced, useRegistrosFiltrados, useOpcoes, atalhos
│       └── lib/             # formatação, utilitários de mês e cálculos (HE, férias, manutenção)
└── out/                     # build gerada (main/preload CJS, renderer)
```

Segurança do Electron: `contextIsolation: true`, `nodeIntegration: false`,
somente `window.api` exposta via `contextBridge`, CSP restritiva no HTML e
links externos abertos no navegador do sistema.

---

## 8. Solução de problemas

| Sintoma | Causa provável / solução |
|---------|--------------------------|
| Toast "A API exigiu login do Google…" | Implantação do Apps Script não é pública — veja seção 4. |
| Toast "Não autorizado (HTTP 401)" | `API_KEY` errada ou vazia em `.env`. |
| Primeira atualização lenta (~30 s) | Cold start do Apps Script — normal, acontece só após inatividade. |
| "Tempo esgotado (60s)" | Planilha muito lenta ou instabilidade; o app tenta 3 vezes com backoff. |
| Janela abre em branco no Linux sem GPU | Rode com `ELECTRON_ENABLE_GPU=1` ou garanta um servidor X/Wayland ativo. |
| Erros de rede no `npm install` | Aumente os retries: `npm install --fetch-retries=5 --fetch-retry-maxtimeout=180000 --fetch-timeout=600000`. |

---

## 9. Observações

- O app **não** inclui dados de exemplo: ele funciona apenas com a API real e
  exibe estados vazios apropriados quando não há lançamentos (as abas locais
  também começam vazias, mas funcionam sem a API).
- `src/types/api-types.ts` é o espelho do contrato da API e **não deve ser
  modificado**.
- O cache em disco é melhor esforço: apague
  `userData/cache-ganhos-gastos.json` (no Linux:
  `~/.config/ganhos-e-gastos/cache-ganhos-gastos.json`) para forçar um recarregamento completo.
- Os dados locais (Hora Extra, Férias, Manutenção) ficam em
  `userData/dados-locais.json` (no Linux:
  `~/.config/ganhos-e-gastos/dados-locais.json`), gravados com debounce e
  escrita atômica — inclusive ao fechar o app. O **salário bruto** e o **KM
  atual** também são persistidos nesse arquivo (compartilhados entre as abas
  locais).

---

## 10. Divisão de contas com a Lívia

As fórmulas estão em `src/renderer/lib/divisao.ts` e são usadas no rodapé de
Lançamentos, nos cartões-resumo e rodapé do Quadro de Pagamentos e no Dashboard:

| Conta | Fórmula | Significado |
|-------|---------|-------------|
| **Total Gasto** | Σ de todos os VALOR do mês | O que foi gasto no total |
| **Recebo Livia** | (Dividido 50/50 ÷ 2) + Livia | Metade do dividido + o que é só da Lívia (ela te repassa) |
| **Total Real** | Total Gasto − Recebo Livia | O que realmente sai do seu bolso |

Regras:
- **"Eu"**: entra integralmente no seu gasto.
- **"Dividido 50/50"**: metade é sua, a outra metade a Lívia te repassa.
- **"Livia"**: gasto só dela — ela te repassa o valor integral, não se divide por 2.

Exemplo (JAN 27): Total Gasto R$ 1.823,41, dois lançamentos Dividido 50/50
somando R$ 1.115,00 → Recebo Livia R$ 557,50 → Total Real R$ 1.265,91.

---

## 11. Campo de saldo na aba Pagamentos

O campo **Saldo em caixa (antes do salário)** é um valor que você digita
manualmente e persiste em `localStorage`. Ele representa quanto você tem no
banco **antes** do salário cair. A coluna **Saldo** da tabela é:

```
Saldo = Saldo em caixa (digitado) + Restante
```

onde `Restante = Salário do mês − Despesas do mês anterior (Meu gasto real)`.

Para o 1º mês do ano (ex.: janeiro de 2027, sem dezembro de 2026 na planilha),
informe as despesas do mês anterior no campo manual específico.
