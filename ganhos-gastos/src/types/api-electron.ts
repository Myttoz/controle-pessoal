/**
 * Contrato de comunicação renderer ↔ main (IPC) e estruturas compartilhadas.
 * Este arquivo é importado pelo preload, pelo main e pelo renderer.
 */
import type {
  InfoAba,
  LancamentoMensal,
  LinhaExtra,
  LinhaSalario,
  LoginResposta,
  PayloadAdicionar,
  PayloadCriarAno,
  PayloadDashboard,
  PayloadEditar,
  PayloadEscrita,
  PayloadLogin,
  PayloadRemover,
  PayloadVerificar,
  Resposta,
  RespostaAbas,
  RespostaAdicionar,
  RespostaAtualizarDashboard,
  RespostaCriarAno,
  RespostaDashboard,
  RespostaEditar,
  RespostaListarExtra,
  RespostaListarMensal,
  RespostaListarSalario,
  RespostaListas,
  RespostaRemover,
  SnapshotAno,
  TokenResposta,
} from './api-types';
import type { DadosLocais } from './dados-locais';

/** Cache persistido em disco pelo processo main (JSON no userData). */
export interface CachePersistido {
  versao: 1;
  /** Timestamp da última gravação. */
  salvoEm: number;
  anoSelecionado: number | null;
  anos: number[];
  snapshots: Record<number, SnapshotAno>;
  atualizadoEm: Record<number, number>;
  listas: Record<string, string[]> | null;
}

/** Resposta de qualquer escrita (adicionar/editar/remover/criarAno/atualizarDashboard). */
export type RespostaEscrita =
  | RespostaAdicionar<LancamentoMensal | LinhaSalario | LinhaExtra>
  | RespostaEditar<LancamentoMensal | LinhaSalario | LinhaExtra>
  | RespostaRemover
  | RespostaCriarAno
  | RespostaAtualizarDashboard;

export type PayloadAdicionarMensal = PayloadAdicionar<LancamentoMensal>;
export type PayloadAdicionarExtra = PayloadAdicionar<LinhaExtra>;
export type PayloadAdicionarSalario = PayloadAdicionar<LinhaSalario>;
export type PayloadEditarMensal = PayloadEditar<LancamentoMensal>;
export type PayloadEditarExtra = PayloadEditar<LinhaExtra>;
export type PayloadEditarSalario = PayloadEditar<LinhaSalario>;

/** Controles da janela sem moldura (barra superior própria). */
export interface JanelaApi {
  minimizar(): Promise<void>;
  /** Alterna maximizar/restaurar e devolve o novo estado. */
  maximizar(): Promise<boolean>;
  fechar(): Promise<void>;
  estado(): Promise<boolean>;
  /** Assina o evento de maximizar/restaurar; devolve a função de limpeza. */
  aoMudarMaximizado(callback: (maximizada: boolean) => void): () => void;
}

/** API exposta ao renderer por `window.api` (contextBridge). */
export interface ApiElectron {
  // ---- controles da janela (indisponível na versão web) ----
  janela?: JanelaApi;

  // ---- leituras (GET) ----
  getAbas(): Promise<RespostaAbas>;
  getAno(ano: number): Promise<Resposta<SnapshotAno>>;
  getDashboard(ano: number, agrupar?: string): Promise<RespostaDashboard>;
  getListas(): Promise<RespostaListas>;
  listar(
    aba: string,
    tabela?: 'ganhos' | 'gastos',
  ): Promise<RespostaListarMensal | RespostaListarSalario | RespostaListarExtra>;

  // ---- escritas (POST, serializadas em fila no main) ----
  escrita(payload: PayloadEscrita): Promise<RespostaEscrita>;

  // ---- autenticação ----
  login(payload: PayloadLogin): Promise<LoginResposta>;
  verificar(payload: PayloadVerificar): Promise<TokenResposta>;
  proxy(payload: Record<string, unknown>): Promise<unknown>;

  // ---- cache em disco ----
  cacheCarregar(): Promise<CachePersistido | null>;
  cacheSalvar(cache: CachePersistido): Promise<void>;

  // ---- dados locais (hora extra, férias, manutenção) — não passam pela API ----
  localCarregar(): Promise<DadosLocais | null>;
  localSalvar(dados: DadosLocais): Promise<void>;

  // ---- diagnóstico ----
  configResumo(): Promise<{ baseUrl: string; temChave: boolean }>;
}

export type { DadosLocais };

export type {
  InfoAba,
  PayloadCriarAno,
  PayloadDashboard,
  PayloadEscrita,
  PayloadLogin,
  PayloadRemover,
  PayloadVerificar,
};
