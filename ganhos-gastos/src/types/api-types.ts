/**
 * ============================================================================
 *  CONTRATO DE TIPOS — API "Ganhos & Gastos"
 * ============================================================================
 *  Espelho EXATO das respostas retornadas pelo web app do Google Apps Script.
 *
 *  Uso no app Electron:
 *     import type { SnapshotAno, RespostaErro } from './api-types';
 *
 *  Convenção: toda resposta tem "sucesso". Use discriminated union:
 *     if (!res.sucesso) return toast(res.erro);   // res é RespostaErro aqui
 *     res.meses;                                 // res é SnapshotAno aqui
 *
 *  BASE_URL: https://script.google.com/macros/s/AKfycbwGtqZPUDzsPFhvEq6LItsqTqnMLDXIAYJIRl5Wp4CXAiEYQgS1gvZy3FTCWbg5NbA/exec
 */

// ---------------------------------------------------------------------------
//  TIPO DE ABA (identificação retornada em várias respostas)
// ---------------------------------------------------------------------------
export type TipoAba = 'MENSAL' | 'SALARIO' | 'EXTRAS' | 'ANUAL';

/** Siglas de mês usadas no NOME das abas e nas colunas MÊS (SUMIF). */
export type SiglaMes =
  | 'JAN' | 'FEV' | 'MAR' | 'ABR' | 'MAI' | 'JUN'
  | 'JUL' | 'AGO' | 'SET' | 'OUT' | 'NOV' | 'DEZ';

// ---------------------------------------------------------------------------
//  FORMULÁRIOS / LISTAS DE OPÇÕES (validações da planilha)
// ---------------------------------------------------------------------------
export const LISTAS = {
  CATEGORIA: [
    'Moradia/Contas', 'Mercado', 'Compra Conjunta', 'Compra Pessoal',
    'Transporte', 'Alimentação', 'Saúde', 'Lazer', 'Assinaturas',
    'Pix/Saldo', 'Outros',
  ],
  'FORMA DE PGTO': [
    'XP', 'NU', 'BB', 'MP', 'MPC', 'Boleto', 'Pix',
    'Dinheiro', 'Folha PGT', 'Livia PG',
  ],
  TIPO: [
    'Fatura futura', 'PIX', 'Boleto', 'Folha de pagamento',
  ],
  'QUEM PAGA': ['Eu', 'Livia', 'Dividido 50/50'],
} as const;

export type Categoria = typeof LISTAS.CATEGORIA[number];
export type FormaPgto = typeof LISTAS['FORMA DE PGTO'][number];
export type TipoPagamento = typeof LISTAS.TIPO[number];
export type QuemPaga = typeof LISTAS['QUEM PAGA'][number];

// ---------------------------------------------------------------------------
//  REGISTROS (conteúdo de cada linha)
// ---------------------------------------------------------------------------

/** Lançamento de uma aba mensal ("JAN 27"). Colunas A..H. */
export interface LancamentoMensal {
  CATEGORIA: Categoria;
  /** Número (aceita entrada formatada "1.234,56", convertida pela API). */
  VALOR: number;
  DESCRIÇÃO: string;
  'FORMA DE PGTO': FormaPgto;
  TIPO: TipoPagamento;
  'QUEM PAGA': QuemPaga;
  /** Data em ISO 'yyyy-MM-dd'. Pode vir vazia ''. */
  DATA: string;
  OBSERVAÇÃO: string;
}

/** Linha da aba "Salário YYYY". Colunas A..L. */
export interface LinhaSalario {
  /** Sigla do mês (JAN..DEZ) — identifica a linha. */
  'MÊS': SiglaMes;
  'SALÁRIO BASE': number;
  '13º': number;
  'FÉRIAS': number;
  'AJUDA CUSTO (info)': number;
  'HORA EXTRA (info)': number;
  OUTROS: number;
  TICKET: number;
  /** CALCULADA (freelance vindo de Extras ganhos) — não editar. */
  FREELANCE: number;
  /** CALCULADA — não editar. */
  'TOTAL SALÁRIO': number;
  /** CALCULADA — não editar. */
  'TOTAL GANHOS': number;
  OBSERVAÇÃO: string;
}

/** Linha da aba "Extras YYYY" (ganhos OU gastos). Colunas A..E / J..N. */
export interface LinhaExtra {
  /** Sigla do mês (JAN..DEZ) — obrigatória para os totais SUMIF calcularem. */
  'MÊS': SiglaMes;
  CATEGORIA: string;
  DESCRIÇÃO: string;
  VALOR: number;
  /** Data em ISO 'yyyy-MM-dd'. */
  DATA: string;
}

/** Abas mensais: colunas de digitação (nenhuma é fórmula). */
export type DadosMensais = Partial<LancamentoMensal>;
/** Salário: colunas editáveis (fórmulas ficam de fora). */
export type DadosSalario = Partial<
  Pick<
    LinhaSalario,
    | 'SALÁRIO BASE' | '13º' | 'FÉRIAS' | 'AJUDA CUSTO (info)'
    | 'HORA EXTRA (info)' | 'OUTROS' | 'TICKET' | 'OBSERVAÇÃO'
  >
>;
/** Extras: colunas editáveis das duas tabelas. */
export type DadosExtra = Partial<Omit<LinhaExtra, never>>;

/** Registro como a API devolve: dados + número da linha (usado em editar/remover). */
export interface Registro<T> {
  /** Número da linha na planilha — identificador estável para editar/remover. */
  linha: number;
  dados: T;
}

// ---------------------------------------------------------------------------
//  BASE DE TODAS AS RESPOSTAS
// ---------------------------------------------------------------------------
export interface RespostaErro {
  sucesso: false;
  erro: string;
  codigo:
    | 'ERRO_DESCONHECIDO' | 'EXCECAO' | 'NAO_AUTORIZADO' | 'ACAO_INVALIDA'
    | 'PARAMETRO_AUSENTE' | 'JSON_INVALIDO' | 'ANO_INVALIDO' | 'LOCK'
    | 'MODELO_AUSENTE' | 'SEM_LINHA' | 'SOMENTE_LEITURA'
    | 'LINHA_INVALIDA' | 'NAO_ENCONTRADO' | 'EMAIL_FALHOU' | 'AGENDA_FALHOU'
    | 'TOKEN_INVALIDO' | 'CREDENCIAIS_INVALIDAS' | 'CONFIG_INVALIDA';
}

export type Resposta<T> = (T & { sucesso: true }) | RespostaErro;

// ---------------------------------------------------------------------------
//  acao=ano  → SNAPSHOT COMPLETO (endpoint principal do app)
// ---------------------------------------------------------------------------
export interface SnapshotAno {
  sucesso: true;
  ano: number;

  /** Chave = sigla do mês. `null` = aba do mês ainda não existe. */
  meses: Partial<Record<SiglaMes, MesSnapshot | null>>;

  /** Abas de mês ausentes (ex.: primeiro semestre de um ano recém-criado). */
  mesesFaltando: string[];

  /** Aba "Salário YYYY" — `null` se não existir. */
  salario: { aba: string; registros: Registro<LinhaSalario>[] } | null;

  /** Aba "Extras YYYY" — `null` se não existir. */
  extras: {
    aba: string;
    ganhos: Registro<LinhaExtra>[];
    gastos: Registro<LinhaExtra>[];
  } | null;

  /** Agregado pronto — use direto no dashboard, não recalcule no cliente. */
  resumo: ResumoDashboard;
}

export interface MesSnapshot {
  /** Nome exato da aba, ex.: "JAN 27". Necessário para adicionar/editar. */
  aba: string;
  registros: Registro<LancamentoMensal>[];
  /** Soma dos VALOR do mês (arredondada em 2 casas). */
  totalLancado: number;
}

// ---------------------------------------------------------------------------
//  DADOS DE DASHBOARD
// ---------------------------------------------------------------------------
export interface ResumoDashboard {
  sucesso: true;
  ano: number;
  /** Coluna usada no agrupamento: 'CATEGORIA' (padrão), 'TIPO', 'FORMA DE PGTO'... */
  chaveAgrupamento: string;
  totalGeral: number;
  /** Ordenado do MAIOR para o menor. */
  categorias: { categoria: string; total: number }[];
  /** Sempre 12 itens (JAN..DEZ), meses sem dados vêm total: 0. */
  meses: { mes: SiglaMes; total: number }[];
  /** Quais abas entraram na conta. */
  abasConsideradas: { aba: string; mes: SiglaMes; total: number }[];
}

/** acao=dashboard */
export type RespostaDashboard = Resposta<ResumoDashboard>;

// ---------------------------------------------------------------------------
//  acao=abas — lista de abas/anos disponíveis
// ---------------------------------------------------------------------------
export interface InfoAba {
  aba: string;
  tipo: TipoAba;
  label: string;
  ano: number | null;
  mes: string | null;
  oculta: boolean;
  indice: number;
}

export type RespostaAbas = Resposta<{ abas: InfoAba[] }>;

// ---------------------------------------------------------------------------
//  acao=listar — listagem de uma aba
// ---------------------------------------------------------------------------
export interface RespostaListar<T> {
  sucesso: true;
  aba: string;
  tipo: TipoAba;
  /** Ordem das colunas do cabeçalho. */
  cabecalhos: string[];
  total: number;
  registros: Registro<T>[];
}

export type RespostaListarMensal = Resposta<RespostaListar<LancamentoMensal>>;
export type RespostaListarSalario = Resposta<RespostaListar<LinhaSalario>>;
export type RespostaListarExtra = Resposta<RespostaListar<LinhaExtra>>;

// ---------------------------------------------------------------------------
//  acao=cabecalhos — metadados p/ montar formulários
// ---------------------------------------------------------------------------
export type RespostaCabecalhos = Resposta<{
  aba: string;
  tipo: TipoAba;
  colunas: { coluna: string; titulo: string }[];
  /** Ex.: "A7:H106" */
  faixaDados: string;
}>;

// ---------------------------------------------------------------------------
//  acao=listas — listas de opções
// ---------------------------------------------------------------------------
export type RespostaListas = Resposta<{
  listas: Record<string, string[]>;
}>;

// ---------------------------------------------------------------------------
//  ESCRITAS (POST)
// ---------------------------------------------------------------------------

/** acao=adicionar */
export type RespostaAdicionar<T> = Resposta<{
  aba: string;
  /** Linha onde o registro foi gravado — guarde para editar/remover. */
  linha: number;
  /** Campos efetivamente preenchidos. */
  gravadas: string[];
  registro: T;
}>;

/** acao=editar */
export type RespostaEditar<T> = Resposta<{
  aba: string;
  linha: number;
  alteradas: string[];
  registro: T;
}>;

/** acao=remover */
export type RespostaRemover = Resposta<{
  aba: string;
  linha: number;
  removido: true;
}>;

/** acao=criarAno */
export type RespostaCriarAno = Resposta<{
  ano: number;
  /** Abas criadas, ex.: ["JAN 28", ..., "Salário 2028", "Extras 2028", "Anual 2028"]. */
  criadas: string[];
  puladasJaExistiam: string[];
  aviso: string | null;
}>;

/** acao=atualizarDashboard — ATENÇÃO: "categorias" aqui é NÚMERO (contagem). */
export type RespostaAtualizarDashboard = Resposta<{
  aba: string;
  ano: number;
  totalGeral: number;
  categorias: number;
}>;

/** acao=teste */
export type RespostaTeste = Resposta<{
  mensagem: string;
  momento: string; // ISO
}>;

// ---------------------------------------------------------------------------
//  PAYLOADS DE ESCRITA (corpo do POST)
// ---------------------------------------------------------------------------
export interface BasePayload {
  chave?: string;
}

export interface PayloadAdicionar<T> extends BasePayload {
  acao: 'adicionar';
  aba: string;
  dados: T;
  /** Só para Extras: 'ganhos' | 'gastos' (padrão 'ganhos'). */
  tabela?: 'ganhos' | 'gastos';
}

export interface PayloadEditar<T> extends BasePayload {
  acao: 'editar';
  aba: string;
  linha: number;
  dados: T;
  tabela?: 'ganhos' | 'gastos';
}

export interface PayloadRemover extends BasePayload {
  acao: 'remover';
  aba: string;
  linha: number;
  tabela?: 'ganhos' | 'gastos';
}

export interface PayloadCriarAno extends BasePayload {
  acao: 'criarAno';
  ano: number;
}

export interface PayloadDashboard extends BasePayload {
  acao: 'atualizarDashboard';
  ano: number;
  agrupar?: string;
}

export type PayloadEscrita =
  | PayloadAdicionar<DadosMensais | DadosSalario | DadosExtra>
  | PayloadEditar<DadosMensais | DadosSalario | DadosExtra>
  | PayloadRemover
  | PayloadCriarAno
  | PayloadDashboard;

// ---------------------------------------------------------------------------
//  AUTENTICAÇÃO (usuário, token, proxy)
// ---------------------------------------------------------------------------

export interface Usuario {
  usuario: string;
  nome?: string;
}

export type LoginResposta = Resposta<{ token: string; usuario: string }>;
export type TokenResposta = Resposta<{ token: string }>;

export interface PayloadLogin {
  acao: 'login';
  usuario: string;
  senha: string;
}

export interface PayloadVerificar {
  acao: 'verificar';
  token: string;
}

export interface PayloadProxy {
  acao: 'proxy';
  token: string;
  acao_real: string;
  [chave: string]: unknown;
}

// ---------------------------------------------------------------------------
//  LEMBRETES (aba LEMBRETES da planilha)
// ---------------------------------------------------------------------------
export type StatusLembrete = 'PENDENTE' | 'ENVIADO' | 'CANCELADO';

/** Um lembrete como a API devolve. */
export interface Lembrete {
  id: string;
  titulo: string;
  /** "AAAA-MM-DD HH:mm:ss" (hora do computador no momento da criação). */
  dataCriacao: string;
  /** "AAAA-MM-DD". */
  dataLembrete: string;
  email: string;
  /** Guardado para uso futuro; hoje não envia WhatsApp. */
  whatsapp: string;
  mensagem: string;
  enviadoEmail: boolean;
  enviadoWhatsapp: boolean;
  eventoId: string;
  status: StatusLembrete;
  enviadoEm: string;
  erro: string;
  /** Número da linha na planilha (uso interno). */
  linha?: number;
}

/** Campos que o app envia ao criar/editar um lembrete. */
export interface DadosLembrete {
  titulo: string;
  dataLembrete: string;
  email: string;
  whatsapp: string;
  mensagem: string;
}

export type RespostaLembretes = Resposta<{ lembretes: Lembrete[] }>;
export type RespostaAdicionarLembrete = Resposta<{ lembrete: Lembrete }>;
export type RespostaEditarLembrete = Resposta<{ lembrete: Lembrete }>;
export type RespostaRemoverLembrete = Resposta<{ removido: boolean; id: string }>;

export interface StatusLembretes {
  aba: string;
  total: number;
  gatilhoAtivo: boolean;
  fuso: string;
  /** Cota diária restante do Gmail (-1 = desconhecida). */
  emailRestante: number;
}

export type RespostaStatusLembretes = Resposta<StatusLembretes>;

export type RespostaInstalarLembretes = Resposta<{
  mensagem: string;
  fuso: string;
  gatilhosAnterioresRemovidos: number;
}>;

export type RespostaTestarLembrete = Resposta<{ mensagem: string }>;

// ---------------------------------------------------------------------------
//  URL BASE
// ---------------------------------------------------------------------------
export const BASE_URL =
  'https://script.google.com/macros/s/AKfycbwGtqZPUDzsPFhvEq6LItsqTqnMLDXIAYJIRl5Wp4CXAiEYQgS1gvZy3FTCWbg5NbA/exec';
