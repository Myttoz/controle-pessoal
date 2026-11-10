# Sistema Comercial — Planilha + API Google Apps Script

Este pacote transforma a planilha **"Ganhos-Gastos 2027.xlsx"** em uma fonte de
dados com **API web**, para que um app externo consiga consultar e alterar os
lançamentos, e ainda gerar **novos anos** e **dashboards** automaticamente.

---

## 1. Estrutura da planilha (como está hoje)

A planilha exportada do Excel Web contém estas **abas de dados** (as demais são
modelos ocultos ou abas auxiliares, que o script ignora):

| Aba            | Tipo    | Cabeçalho (linha) | Dados            | O que é |
|----------------|---------|-------------------|------------------|---------|
| `Anual 2027`   | Anual   | linha 4           | linhas 5–16      | Visão consolidada (somente leitura — é cálculo) |
| `Salário 2027` | Salário | linha 3           | linhas 4–15      | 12 meses fixos (JAN..DEZ) |
| `Extras 2027`  | Extras  | linha 3           | linhas 4–40      | Duas tabelas lado a lado: **ganhos** (A–E) e **gastos** (J–N) |
| `JAN 27`       | Mensal  | linha 6           | linhas 7–106     | Lançamentos do mês |

> **Padrão de nomes de mês:** `JAN 27`, `FEV 27` ... `DEZ 27`
> (abreviação + espaço + **2 dígitos** do ano).

### Colunas da aba Mensal (`JAN 27`)
```
A: CATEGORIA   B: VALOR   C: DESCRIÇÃO   D: FORMA DE PGTO
E: TIPO        F: QUEM PAGA   G: DATA   H: OBSERVAÇÃO
```

### Modelos ocultos usados para gerar um novo ano
```
Modelo Anual Atualizado · Modelo Salário Atualizado
Modelo Extra Atualizado · Modelo Mensal Atualizado
```

> **Você não altera a estrutura.** O script apenas **copia** esses modelos para
> criar um novo ano e **ajusta as fórmulas** para apontarem às novas abas.

---

## 2. Arquivos do script

| Arquivo              | O que faz |
|----------------------|-----------|
| `Config.gs`          | Toda a configuração: padrões de nomes, colunas, listas e API key |
| `Util.gs`            | Funções auxiliares (detectar tipo de aba, cabeçalhos, JSON) |
| `Servico.gs`         | Operações CRUD (listar, adicionar, editar, remover) |
| `Dashboard.gs`       | Agrega gastos por categoria e desenha os gráficos |
| `AnoNovo.gs`         | Gera todas as abas de um novo ano |
| `Api.gs`             | `doGet` / `doPost` — o roteador da API |
| `Inicializacao.gs`   | Funções para rodar 1 vez no editor (registrar planilha, etc.) |

---

## 3. Como instalar

### 3.1 Converta a planilha para o Google Sheets
1. Suba o arquivo `.xlsx` para o seu Google Drive.
2. Abra com **Google Sheets** (clique duas vezes). O Drive converte para o
   formato Google — é isso que permite usar o Apps Script.
   > Se preferir: **Arquivo → Salvar como → Google Planilhas**.

> ⚠️ **Importante:** o Apps Script só funciona em arquivos no formato Google
> Sheets, não em `.xlsx` puro. Mantenha o `.xlsx` apenas como backup.

### 3.2 Crie o projeto do Apps Script
1. Na planilha aberta, vá em **Extensões → Apps Script**.
2. Você verá um arquivo `Código` padrão. **Apague** o conteúdo dele.
3. Crie um arquivo novo para cada `.gs` desta pasta:
   - Clique em **+ (Ao lado de "Arquivos") → Script**.
   - Dê o nome (ex.: `Config`) e cole o conteúdo do `Config.gs`.
   - Repita para todos: `Util`, `Servico`, `Dashboard`, `AnoNovo`, `Api`,
     `Inicializacao`.
   > Não inclua a extensão `.gs` no nome — o editor adiciona sozinho.

### 3.3 Rode a inicialização (1 vez)
1. No topo do editor, no seletor de funções, escolha **`passo1_registrarPlanilha`**.
2. Clique em **▶ Executar**.
3. O Google pedirá permissões:
   - **Revisar permissões** → escolha sua conta.
   - Se aparecer "Este app não foi verificado", clique em
     **Configurações avançadas → Ir para (nome do projeto)** → **Permitir**.
   - Aceite as permissões de planilha.
4. Uma mensagem confirma o registro do ID da planilha.

> **Para testar sem publicar ainda:** rode também `teste_listarAbas` e
> `teste_lerMes` e veja o resultado em **Visualizar → Registros**.

---

## 4. Como publicar como Web App

1. No editor do Apps Script, clique em **Implantar → Implantação nova**.
2. Em **Tipo de implantação**, escolha **Aplicativo da Web**.
3. Preencha:
   | Campo | Valor |
   |-------|-------|
   | **Executar como** | **Eu** (o dono da planilha) |
   | **Quem tem acesso** | **Qualquer pessoa** *(ou "Qualquer pessoa com conta Google", se quiser restringir)* |
4. Clique em **Implantar** e **copie a URL** gerada
   (termina em `/exec`).
5. **Importante:** clique em **Implantar → Gerenciar implantações** → caneta ✏️
   da implantação atual → **Nova versão** → **Implantar**. Faça isso **sempre
   que alterar o código**, senão o app continua chamando a versão antiga.

### Sobre a URL
- URL de produção: `.../exec` → use no seu app externo.
- URL de teste: `.../dev` → usa o código salvo, sem precisar criar versão.

---

## 5. Configurando a chave de API (segurança)

Como "Quem tem acesso = Qualquer pessoa", **proteja a API com uma chave**.

1. Abra `Config.gs` e preencha:
   ```js
   API_KEY: 'cole_aqui_uma_chave_forte_e_secreta',
   ```
2. Salve e **crie uma nova versão** da implantação (seção 4, passo 5).

Agora toda chamada precisa levar a chave:
- **GET:** `...&chave=SUA_CHAVE`
- **POST:** no corpo JSON: `"chave": "SUA_CHAVE"`

> Se `API_KEY` ficar em branco (`''`), a API fica **aberta**. Só use assim em
> testes locais.

---

## 6. Usando a API (para o app externo)

Base da URL: `SUA_URL_EXEC`

### 6.1 Listar as abas de dados
```
GET  {base}?acao=abas&chave=SUA_CHAVE
```
Resposta:
```json
{
  "sucesso": true,
  "abas": [
    { "aba": "Anual 2027",  "tipo": "ANUAL",   "ano": 2027, "mes": null, "oculta": false },
    { "aba": "Salário 2027","tipo": "SALARIO", "ano": 2027, "mes": null, "oculta": false },
    { "aba": "Extras 2027", "tipo": "EXTRAS",  "ano": 2027, "mes": null, "oculta": false },
    { "aba": "JAN 27",      "tipo": "MENSAL",  "ano": 2027, "mes": "JAN","oculta": false }
  ]
}
```

### 6.2 Listar registros de uma aba mensal
```
GET  {base}?acao=listar&aba=JAN%2027&chave=SUA_CHAVE
```
Resposta:
```json
{
  "sucesso": true,
  "aba": "JAN 27",
  "tipo": "MENSAL",
  "cabecalhos": ["CATEGORIA","VALOR","DESCRIÇÃO","FORMA DE PGTO","TIPO","QUEM PAGA","DATA","OBSERVAÇÃO"],
  "total": 12,
  "registros": [
    { "linha": 7,
      "dados": {
        "CATEGORIA": "Moradia/Contas", "VALOR": 150, "DESCRIÇÃO": "Energia",
        "FORMA DE PGTO": "BB", "TIPO": "Fatura futura", "QUEM PAGA": "Eu",
        "DATA": "2027-01-10", "OBSERVAÇÃO": ""
      }
    }
  ]
}
```
> **Guarde o número `linha`** — é ele que você usa para editar ou remover.

### 6.3 Atalho por ano/mês
```
GET  {base}?acao=registros&ano=2027&mes=JAN&chave=SUA_CHAVE
```

### 6.4 Ler só os cabeçalhos (para montar formulário)
```
GET  {base}?acao=cabecalhos&aba=JAN%2027&chave=SUA_CHAVE
```

### 6.5 Listas suspensas (valores aceitos)
```
GET  {base}?acao=listas&chave=SUA_CHAVE
```
> Retorna `CATEGORIA`, `FORMA DE PGTO`, `TIPO`, `QUEM PAGA`, `MES_EXTRAS`.
> Use no app para preencher os campos com seleção, em vez de texto livre.

### 6.6 Adicionar registro (POST)
```http
POST {base}
Content-Type: application/json

{
  "chave": "SUA_CHAVE",
  "acao": "adicionar",
  "aba": "JAN 27",
  "dados": {
    "CATEGORIA": "Mercado",
    "VALOR": 250.90,
    "DESCRIÇÃO": "Compra semana",
    "FORMA DE PGTO": "XP",
    "TIPO": "Fatura futura",
    "QUEM PAGA": "Dividido 50/50",
    "DATA": "2027-01-15",
    "OBSERVAÇÃO": ""
  }
}
```
Resposta:
```json
{ "sucesso": true, "aba": "JAN 27", "linha": 19, "gravadas": ["CATEGORIA","VALOR", "..."] }
```

### 6.7 Editar registro (POST)
```json
{
  "chave": "SUA_CHAVE",
  "acao": "editar",
  "aba": "JAN 27",
  "linha": 19,
  "dados": { "VALOR": 275.50, "DESCRIÇÃO": "Compra corrigida" }
}
```
> Só as colunas enviadas em `dados` são alteradas. As demais ficam como estão.

### 6.8 Remover registro (POST)
```json
{ "chave": "SUA_CHAVE", "acao": "remover", "aba": "JAN 27", "linha": 19 }
```

### 6.9 Extras (ganhos e gastos)
A aba Extras tem **duas tabelas**. Use o campo `tabela` (`ganhos` ou `gastos`):

```json
{ "chave": "...", "acao": "adicionar", "aba": "Extras 2027", "tabela": "ganhos",
  "dados": { "MÊS": "JANEIRO", "CATEGORIA": "Freelance", "DESCRIÇÃO": "Site", "VALOR": 1200, "DATA": "2027-01-20" } }
```
```json
{ "chave": "...", "acao": "adicionar", "aba": "Extras 2027", "tabela": "gastos",
  "dados": { "MÊS": "JANEIRO", "CATEGORIA": "Manutenção", "DESCRIÇÃO": "Notebook", "VALOR": 300, "DATA": "2027-01-21" } }
```
Listando:
```
GET {base}?acao=listar&aba=Extras%202027&tabela=ganhos&chave=SUA_CHAVE
```

### 6.10 Salário
A aba Salário tem **12 linhas fixas** (uma por mês). Edite pela linha:
```
GET  {base}?acao=listar&aba=Salário%202027&chave=SUA_CHAVE   →  veja "linha": 4 = JAN
POST { "acao":"editar", "aba":"Salário 2027", "linha": 4, "dados": { "SALÁRIO BASE": 5000 } }
```

### 6.11 Dashboard (JSON, para o app desenhar seus próprios gráficos)
```
GET  {base}?acao=dashboard&ano=2027&chave=SUA_CHAVE
```
Resposta:
```json
{
  "sucesso": true,
  "ano": 2027,
  "totalGeral": 2340.5,
  "categorias": [
    { "categoria": "Moradia/Contas", "total": 793.41 },
    { "categoria": "Mercado",        "total": 900 }
  ],
  "meses": [ { "mes": "JAN", "total": 1793.41 }, { "mes": "FEV", "total": 0 } ]
}
```
> Para agrupar por outra coluna (ex.: `TIPO` ou `FORMA DE PGTO`), acrescente
> `&agrupar=TIPO`.

### 6.12 Criar um novo ano (POST)
```json
{ "chave": "SUA_CHAVE", "acao": "criarAno", "ano": 2028 }
```
Resposta:
```json
{ "sucesso": true, "ano": 2028,
  "criadas": ["JAN 28","FEV 28", "...", "Salário 2028", "Extras 2028", "Anual 2028"],
  "puladasJaExistiam": [] }
```

### 6.13 Gerar/atualizar a aba Dashboard com gráficos (POST)
```json
{ "chave": "SUA_CHAVE", "acao": "atualizarDashboard", "ano": 2027 }
```
> Cria (ou recria) a aba **Dashboard** na planilha com **pizza de categorias**
> e **colunas por mês**.

---

## 7. Exemplo mínimo em JavaScript (app externo)

```js
const BASE = 'SUA_URL_EXEC';
const CHAVE = 'SUA_CHAVE';

// Listar gastos de janeiro/2027
async function listarJan() {
  const url = `${BASE}?acao=registros&ano=2027&mes=JAN&chave=${CHAVE}`;
  const r = await fetch(url);
  return r.json();   // { sucesso, registros: [ {linha, dados}, ... ] }
}

// Adicionar um gasto
async function adicionar(dados) {
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },  // evita CORS
    body: JSON.stringify({ chave: CHAVE, acao: 'adicionar', aba: 'JAN 27', dados })
  });
  return r.json();
}
```

> **CORS:** o Apps Script não envia cabeçalhos CORS. Em app web (navegador),
> use `Content-Type: text/plain` no POST (como acima) ou faça as chamadas pelo
> backend do seu app. Em app mobile (React Native, Flutter, etc.) não há
> problema.

---

## 8. Dúvidas e problemas comuns

| Problema | Solução |
|----------|---------|
| `Não autorizado` | A chave está errada ou `API_KEY` não foi preenchida em `Config.gs` |
| `Aba não reconhecida` | O nome da aba não bate com o padrão (`JAN 27`, `Salário 2027`...) |
| Mudou o código e nada mudou na API | **Crie uma nova versão** da implantação (seção 4) |
| `Planilha não encontrada` | Rode `passo1_registrarPlanilha` de novo |
| App web bloqueado por CORS | Use `Content-Type: text/plain` no POST (seção 7) |
| Quero mudar as listas suspensas | Edite `CONFIG.LISTAS` em `Config.gs` |
| Quero mais linhas de dados | Ajuste `dataEnd` em `Config.gs` |

---

## 9. Resumo das ações da API

| Ação | Método | Parâmetros |
|------|--------|-----------|
| `teste` | GET | — |
| `abas` | GET | — |
| `listar` | GET | `aba`, `tabela?` |
| `registros` | GET | `ano`, `mes` |
| `cabecalhos` | GET | `aba`, `tabela?` |
| `listas` | GET | — |
| `dashboard` | GET | `ano`, `agrupar?` |
| `adicionar` | POST | `aba`, `dados`, `tabela?` |
| `editar` | POST | `aba`, `linha`, `dados`, `tabela?` |
| `remover` | POST | `aba`, `linha`, `tabela?` |
| `criarAno` | POST | `ano` |
| `atualizarDashboard` | POST | `ano`, `agrupar?` |
