# PROMPT — App "Ganhos & Gastos" — 3 versões (React + Vite + TypeScript)

> Cole o bloco abaixo inteiro no seu assistente de código.
> Depois, cole também o conteúdo de `codigo/tipos/api-types.ts` como parte do projeto.
>
> Escopo: uma ÚNICA base de código React que gera:
>   a) Versão WEB (hospedada no GitHub Pages, acesso por link + login)
>   b) Versão DESKTOP LINUX (instalador .AppImage + .deb)
>   c) Versão DESKTOP WINDOWS (instalador .exe NSIS)
>
> Todas consomem a mesma API do Google Apps Script. Uso 100% pessoal.

===============================================================================
0. CONTEXTO E ARQUITETURA
===============================================================================
- Base compartilhada: React + TypeScript + Vite.
- Backend: Google Apps Script (mesma implantação já no ar).
- Comunicação WEB: `fetch()` do navegador para `/exec?acao=proxy`.
- Comunicação DESKTOP: Electron (processo main) chama a mesma URL `/exec`.
- Autenticação: login/senha contra aba `Usuarios` da planilha; sessão via token.
- Proxy: o front chama `acao=proxy` com o token; o Apps Script injeta a `API_KEY`
  secreta nos bastidores. O front NUNCA vê nem envia a `API_KEY`.
- Backup: mantido no Google Drive (gatilho de 15 dias já instalado), independente
  da versão usada.

URL da API (já implantada):
https://script.google.com/macros/s/AKfycbwGtqZPUDzsPFhvEq6LItsqTqnMLDXIAYJIRl5Wp4CXAiEYQgS1gvZy3FTCWbg5NbA/exec

===============================================================================
1. CONTRATO DE TIPOS (TypeScript)
===============================================================================
Adicione o arquivo `src/types/api-types.ts` EXATAMENTE com o conteúdo que
vou fornecer ao lado deste prompt. Interfaces: Usuario, TokenResposta,
LoginResposta, Registro, LancamentoMensal, LinhaSalario, LinhaExtra,
SnapshotAno, ResumoDashboard e os tipos de resposta da API.

Use `import type` em todo o projeto. NÃO redeclare essas interfaces.
NÃO use `any` onde já exista tipo definido.

===============================================================================
2. AUTENTICAÇÃO (endpoints do Apps Script)
===============================================================================
O back-end (Apps Script) já expõe estas ações via `doPost` (implantado):

  ?acao=login
    Corpo JSON: { "usuario": "seu_usuario", "senha": "sua_senha" }
    Resposta: { "sucesso": true, "token": "<token_sessao>", "usuario": "..." }

  ?acao=verificar
    Corpo JSON: { "token": "<token_sessao>" }
    Resposta: { "sucesso": true, "usuario": "..." }

  ?acao=proxy
    Corpo JSON: { "token": "<token_sessao>", "acao_real": "ano|listar|...", ... }
    Resposta: o mesmo que a ação real retornaria, já com a API_KEY injetada.

O front deve:
  - Ter uma página de login (/login) com usuário e senha.
  - Ao logar, guardar o token em localStorage.
  - Em toda requisição de dados, enviar o token via ação `proxy`.
  - Se o token expirar, redirecionar para /login.
  - Proteger rotas: sem token válido, bloqueia acesso às áreas.

===============================================================================
3. API DE DADOS (via proxy)
===============================================================================
BASE = URL da seção 0, sempre via ação `proxy`.

Exemplos de corpo JSON para `acao=proxy`:

  { "token": "...", "acao_real": "ano", "ano": 2027 }
    → SNAPSHOT COMPLETO DO ANO (12 meses + salário + extras + resumo)

  { "token": "...", "acao_real": "abas" }
    → lista anos/abas disponíveis

  { "token": "...", "acao_real": "listas" }
    → listas de opções válidas

  { "token": "...", "acao_real": "listar", "aba": "JAN 27", "tabela": "ganhos|gastos" }

  { "token": "...", "acao_real": "adicionar", "aba": "JAN 27", "dados": {...} }
  { "token": "...", "acao_real": "editar", "aba": "JAN 27", "linha": 7, "dados": {...} }
  { "token": "...", "acao_real": "remover", "aba": "JAN 27", "linha": 7 }

  { "token": "...", "acao_real": "criarAno", "ano": 2028 }
  { "token": "...", "acao_real": "atualizarDashboard", "ano": 2027 }
  { "token": "...", "acao_real": "dashboard", "ano": 2027, "agrupar": "CATEGORIA" }

Toda resposta é JSON: { "sucesso": true|false, ... }.
Em erro: { "sucesso": false, "erro": "...", "codigo": "..." }.

Listas válidas (dropdowns):
  CATEGORIA: Moradia/Contas, Mercado, Compra Conjunta, Compra Pessoal,
             Transporte, Alimentação, Saúde, Lazer, Assinaturas, Pix/Saldo, Outros
  FORMA DE PGTO: XP, NU, BB, MP, MPC, Boleto, Pix, Dinheiro, Folha PGT, Livia PG
  TIPO: Fatura futura, PIX, Boleto, Folha de pagamento
  QUEM PAGA: Eu, Livia, Dividido 50/50

===============================================================================
4. ÁREAS DO APLICATIVO (compartilhadas por web e desktop)
===============================================================================

A) LOGIN (tela de entrada)
   - Campos: usuário e senha.
   - Botão: Entrar.
   - Mensagem de erro se credenciais inválidas.
   - Ao entrar, redireciona para o Dashboard.

B) DASHBOARD (inicial após login)
   - Indicadores: total gasto no ano, total do mês atual, maior categoria,
     média mensal, saldo (ganhos - gastos).
   - Gráfico de pizza: gastos por CATEGORIA.
   - Gráfico de colunas: gastos por MÊS.
   - Seletor de ano (alterna o contexto de TODO o app).
   - Use o "resumo" vindo do snapshot. NÃO some lançamentos no cliente
     quando a API já devolve o agregado.

C) LANÇAMENTOS (área principal)
   - Listagem dos gastos do mês, com seletor de mês (JAN..DEZ).
   - Busca por texto e filtros por CATEGORIA, TIPO, FORMA DE PGTO, QUEM PAGA
     e faixa de DATA.
   - Cadastro, edição e exclusão de registros.
   - Mostrar o total filtrado em tempo real.

D) QUADRO DE PAGAMENTOS (Kanban por TIPO)
   - Colunas: "Fatura futura", "PIX", "Boleto", "Folha de pagamento".
   - Cartões = lançamentos do mês (categoria, valor, descrição).
   - Arrastar entre colunas altera o TIPO (via proxy, atualização otimista).

E) GANHOS (Salário e Extras)
   - Salário: SALÁRIO BASE, 13º, FÉRIAS, OUTROS, TICKET, OBSERVAÇÃO.
     NUNCA edite FREELANCE, TOTAL SALÁRIO, TOTAL GANHOS.
   - Extras: duas abas — "Ganhos" e "Gastos" — com MÊS, CATEGORIA,
     DESCRIÇÃO, VALOR, DATA. Sempre enviar "tabela" no proxy.

F) GESTÃO DE ANOS
   - Lista anos existentes (proxy → acao_real=abas).
   - Botão "Criar novo ano" → criarAno via proxy.
   - Oferecer geração do Dashboard do ano (proxy → atualizarDashboard).

===============================================================================
5. PERFORMANCE — OBRIGATÓRIO
===============================================================================
NUNCA buscar dados ao montar uma aba. Sem fetch em useEffect de navegação.

 5.1 Cache em memória por ano (Zustand): UMA chamada proxy (acao_real=ano)
     por ano. Todas as áreas leem desse cache.
 5.2 Stale-while-revalidate: cache exibido imediatamente; requisição em
     segundo plano atualiza silenciosamente.
 5.3 Persistir cache e sessão em localStorage (web) / electron-store (desktop).
 5.4 Atualização otimista: gravar/editar/remover atualiza o estado local na
     hora; dispara API em segundo plano; se falhar, reverte e mostra toast.
 5.5 Busca e filtros sobre o cache local — debounce ~200ms.
 5.6 Escrita em sequência por operação (API usa lock na planilha).
 5.7 Retry com backoff exponencial e timeout de 60s. Trate cold start
     (~30s na 1ª chamada do Apps Script).
 5.8 Memoize totais (useMemo); virtualize lista se > 200 linhas.
 5.9 Loading bloqueante SÓ na primeira abertura sem cache.

===============================================================================
6. EMPACOTAMENTO E DISTRIBUIÇÃO (3 versões)
===============================================================================
O código-fonte é ÚNICO (React + Vite + TS). Adicionar electron-builder como
devDependency e estes scripts no package.json:

  "dist:linux": "npm run build && electron-builder --linux",
  "dist:win":   "npm run build && electron-builder --win",
  "dist":       "npm run build && electron-builder --win --linux",
  "web:build":  "npm run build",
  "web:deploy": "gh-pages -d dist"  (ou GitHub Actions)

Configuração electron-builder (campo "build" no package.json ou electron-builder.yml):
  - appId: com.pessoal.ganhosegastos
  - productName: Ganhos & Gastos
  - directories.output: release
  - files: somente out/** e package.json
  - targets Linux (x64): AppImage + deb
  - targets Windows (x64): nsis
  - artifactName: "${productName} ${version} Setup.${ext}"
  - ícone: padrão do Electron (não precisa gerar imagem)

CHAVE DA API NO DESKTOP:
  src/main/config.ts resolve:
    baseUrl = env || .env || BASE_PADRAO
    chave   = env || .env || CHAVE_PADRAO
  Adicionar constante CHAVE_PADRAO com o mesmo valor de API_KEY do .env atual.
  NÃO mudar precedência: .env (desenvolvimento) continua sobrepondo.
  A leitura de .env em cwd e userData deve permanecer intacta.

CHAVE DA API NA WEB:
  NUNCA expor API_KEY no front-end. O proxy do Apps Script injeta a chave nos
  bastidores. O front só envia o token.

===============================================================================
7. HOSPEDAGEM WEB (GitHub Pages — gratuito)
===============================================================================
O código-fonte fica num repositório GitHub. GitHub Actions:
  - npm install
  - npm run build (Vite)
  - deploy para GitHub Pages

O front acessa a URL do Apps Script (fixa, via VITE_API_URL ou constante).
Não há servidor próprio, não há custo de hospedagem.

===============================================================================
8. ESTRUTURA DE PASTAS
===============================================================================
src/
  main/           (Electron main, IPC, chamadas HTTP — só desktop)
  preload/        (contextBridge — só desktop)
  renderer/
    components/
    features/     (auth, dashboard, lancamentos, kanban, ganhos, anos)
    store/        (Zustand: authStore, anoStore, uiStore)
    services/     (camada fetch para /exec?acao=proxy)
    types/        (api-types.ts)
    hooks/
    pages/        (Login, Dashboard, Lancamentos, Kanban, Ganhos, Anos)

===============================================================================
9. REQUISITOS TÉCNICOS
===============================================================================
 - React + TypeScript + Vite (build estático para web; Electron para desktop).
 - Estado global: Zustand.
 - Sessão e cache: localStorage (web) / electron-store (desktop).
 - Chamadas HTTP: fetch() (web) ou Electron net/fetch via IPC (desktop).
 - TypeScript estrito (strict: true). Sem `any` desnecessário.
 - Gráficos: recharts. Drag and drop: @dnd-kit.
 - Ícones: lucide-react.
 - Estilização: Tailwind CSS, modo escuro, layout responsivo.
 - Tratamento de erros global: toast + UI continua útil.
 - Estados vazios, carregamento e erro em cada área.
 - Não inclua dados de exemplo: o app funciona apenas com a API real.

===============================================================================
10. ENTREGÁVEIS
===============================================================================
 - Código-fonte completo e organizado (React + Vite + TS).
 - Pasta release/ com:
     • instalador Windows (.exe NSIS)
     • AppImage Linux (portátil) + .deb Linux
 - Config do GitHub Actions para deploy web no GitHub Pages.
 - .env.example com VITE_API_URL (sem API_KEY).
 - Instruções: npm install / npm run dev / npm run build / dist / dist:linux / dist:win.
 - Não inclua dados de exemplo.
===============================================================================
