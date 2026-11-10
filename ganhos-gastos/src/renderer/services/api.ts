/**
 * Camada de serviço — único ponto do renderer que fala com `window.api` (IPC).
 * Converte `sucesso:false` em exceção e normaliza mensagens de erro.
 *
 * Todas as chamadas de dados enviam o token de sessão via `acao=proxy`;
 * o Apps Script injeta a API_KEY nos bastidores. O front NUNCA vê a chave.
 */
import type {
  DadosLembrete,
  InfoAba,
  Lembrete,
  LoginResposta,
  PayloadEscrita,
  Resposta,
  RespostaErro,
  SnapshotAno,
  StatusLembretes,
  TokenResposta,
} from '@/types/api-types';
import type {
  CachePersistido,
  DadosLocais,
  RespostaEscrita,
} from '@/types/api-electron';
import { api } from './ponte';

export class ErroResposta extends Error {
  readonly codigo?: string;

  constructor(mensagem: string, codigo?: string) {
    super(mensagem);
    this.name = 'ErroResposta';
    this.codigo = codigo;
  }
}

/** Mensagem amigável para toast, seja ErroResposta, Error ou valor desconhecido. */
export function msgDeErro(erro: unknown): string {
  if (erro instanceof ErroResposta) {
    return erro.codigo ? `${erro.message} [${erro.codigo}]` : erro.message;
  }
  if (erro instanceof Error && erro.message) return erro.message;
  return 'Erro inesperado.';
}

function erroDeResposta(resposta: RespostaErro): ErroResposta {
  return new ErroResposta(resposta.erro || 'A API retornou erro.', resposta.codigo);
}

function erroDeExcecao(erro: unknown): ErroResposta {
  if (erro instanceof ErroResposta) return erro;
  const mensagem =
    erro instanceof Error && erro.message
      ? erro.message
      : 'Falha de comunicação com o processo principal.';
  return new ErroResposta(mensagem);
}

// ---------------------------------------------------------------------------
//  Sessão expirada → o store de autenticação faz logout automaticamente.
// ---------------------------------------------------------------------------
let aoNaoAutorizado: (() => void) | null = null;

/** Registra o callback chamado quando a API responde "token inválido". */
export function definirAoNaoAutorizado(cb: () => void): void {
  aoNaoAutorizado = cb;
}

function notificarNaoAutorizado(resposta: RespostaErro): void {
  if (resposta.codigo === 'NAO_AUTORIZADO' || resposta.codigo === 'TOKEN_INVALIDO') {
    aoNaoAutorizado?.();
  }
}

/** Aguarda a resposta e lança ErroResposta quando sucesso === false. */
async function exigeSucesso<T>(promessa: Promise<Resposta<T>>): Promise<T & { sucesso: true }> {
  let resposta: Resposta<T>;
  try {
    resposta = await promessa;
  } catch (e) {
    throw erroDeExcecao(e);
  }
  if (!resposta.sucesso) {
    notificarNaoAutorizado(resposta);
    throw erroDeResposta(resposta);
  }
  return resposta;
}

async function exigeEscrita(
  promessa: Promise<RespostaEscrita>,
): Promise<RespostaEscrita & { sucesso: true }> {
  let resposta: RespostaEscrita;
  try {
    resposta = await promessa;
  } catch (e) {
    throw erroDeExcecao(e);
  }
  if (!resposta.sucesso) {
    notificarNaoAutorizado(resposta);
    throw erroDeResposta(resposta);
  }
  return resposta as RespostaEscrita & { sucesso: true };
}

/** Token de sessão injetado pelo store de autenticação. */
let tokenSessao = '';

/** Define o token a ser usado nas chamadas autenticadas (proxy). */
export function setTokenSessao(token: string): void {
  tokenSessao = token;
}

/** Limpa o token (logout). */
export function limparTokenSessao(): void {
  tokenSessao = '';
}

/**
 * Constrói o payload de proxy com o token e a ação real.
 * Os campos fixos vêm DEPOIS do spread: assim nenhum parâmetro (ex.: o
 * `acao: 'adicionar'` de uma escrita) consegue sobrescrever `acao: 'proxy'`.
 */
function proxyPayload(acaoReal: string, params: Record<string, unknown>): Record<string, unknown> {
  return {
    ...params,
    acao: 'proxy',
    token: tokenSessao,
    acao_real: acaoReal,
  };
}

export const servicoApi = {
  // ---- autenticação (sem token, chamado diretamente) ----
  login: async (
    usuario: string,
    senha: string,
  ): Promise<LoginResposta> => {
    const resposta = await api.login({ acao: 'login', usuario, senha });
    if (!resposta.sucesso) {
      throw new ErroResposta(resposta.erro || 'Login falhou.', resposta.codigo);
    }
    return resposta;
  },

  verificar: async (token: string): Promise<TokenResposta> => {
    const resposta = await api.verificar({ acao: 'verificar', token });
    if (!resposta.sucesso) {
      throw new ErroResposta(resposta.erro || 'Sessão inválida.', resposta.codigo);
    }
    return resposta;
  },

  // ---- leituras (via proxy) ----
  getAbas: (): Promise<{ abas: InfoAba[] } & { sucesso: true }> =>
    exigeSucesso(
      api.proxy(proxyPayload('abas', {})) as Promise<
        Resposta<{ abas: InfoAba[] }>
      >,
    ),

  getAno: (ano: number): Promise<SnapshotAno> =>
    exigeSucesso(
      api.proxy(proxyPayload('ano', { ano })) as Promise<
        Resposta<SnapshotAno>
      >,
    ),

  getDashboard: (ano: number, agrupar?: string) =>
    exigeSucesso(
      api.proxy(
        proxyPayload('dashboard', { ano, ...(agrupar ? { agrupar } : {}) }),
      ) as Promise<Resposta<import('@/types/api-types').ResumoDashboard>>,
    ),

  getListas: (): Promise<{ listas: Record<string, string[]> } & { sucesso: true }> =>
    exigeSucesso(
      api.proxy(proxyPayload('listas', {})) as Promise<
        Resposta<{ listas: Record<string, string[]> }>
      >,
    ),

  listar: (aba: string, tabela?: 'ganhos' | 'gastos') =>
    api.proxy(
      proxyPayload('listar', { aba, ...(tabela ? { tabela } : {}) }),
    ) as Promise<
      import('@/types/api-types').RespostaListarMensal
    >,

  // ---- lembretes (via proxy) ----
  getLembretes: (): Promise<{ lembretes: Lembrete[] } & { sucesso: true }> =>
    exigeSucesso(
      api.proxy(proxyPayload('lembretes', {})) as Promise<
        Resposta<{ lembretes: Lembrete[] }>
      >,
    ),

  getStatusLembretes: (): Promise<StatusLembretes & { sucesso: true }> =>
    exigeSucesso(
      api.proxy(proxyPayload('statusLembretes', {})) as Promise<
        Resposta<StatusLembretes>
      >,
    ),

  adicionarLembrete: (dados: DadosLembrete): Promise<{ lembrete: Lembrete } & { sucesso: true }> =>
    exigeSucesso(
      api.proxy(proxyPayload('adicionarLembrete', { dados })) as Promise<
        Resposta<{ lembrete: Lembrete }>
      >,
    ),

  editarLembrete: (
    id: string,
    dados: DadosLembrete,
  ): Promise<{ lembrete: Lembrete } & { sucesso: true }> =>
    exigeSucesso(
      api.proxy(proxyPayload('editarLembrete', { id, dados })) as Promise<
        Resposta<{ lembrete: Lembrete }>
      >,
    ),

  removerLembrete: (id: string): Promise<{ removido: boolean; id: string } & { sucesso: true }> =>
    exigeSucesso(
      api.proxy(proxyPayload('removerLembrete', { id })) as Promise<
        Resposta<{ removido: boolean; id: string }>
      >,
    ),

  testarLembrete: (id: string): Promise<{ mensagem: string } & { sucesso: true }> =>
    exigeSucesso(
      api.proxy(proxyPayload('testarLembrete', { id })) as Promise<
        Resposta<{ mensagem: string }>
      >,
    ),

  instalarLembretes: (): Promise<
    { mensagem: string; fuso: string; gatilhosAnterioresRemovidos: number } & { sucesso: true }
  > =>
    exigeSucesso(
      api.proxy(proxyPayload('instalarLembretes', {})) as Promise<
        Resposta<{ mensagem: string; fuso: string; gatilhosAnterioresRemovidos: number }>
      >,
    ),

  // ---- escritas (via proxy) ----
  // A ação real do payload (adicionar/editar/remover/criarAno/atualizarDashboard)
  // vai como acao_real — o Auth.gs despacha direto para o serviço correspondente.
  escrita: (payload: PayloadEscrita): Promise<RespostaEscrita & { sucesso: true }> => {
    const { acao, ...resto } = payload;
    return exigeEscrita(
      api.proxy(
        proxyPayload(acao, resto as unknown as Record<string, unknown>),
      ) as Promise<RespostaEscrita>,
    );
  },

  // ---- cache (falha aqui nunca derruba o app) ----
  cacheCarregar: async (): Promise<CachePersistido | null> => {
    try {
      const cache = await api.cacheCarregar();
      return cache && cache.versao === 1 && typeof cache.snapshots === 'object'
        ? cache
        : null;
    } catch {
      return null;
    }
  },

  cacheSalvar: async (cache: CachePersistido): Promise<void> => {
    try {
      await api.cacheSalvar(cache);
    } catch {
      // persistência é melhor esforço — UI continua funcionando
    }
  },

  // ---- dados locais (hora extra, férias, manutenção) ----
  localCarregar: async (): Promise<DadosLocais | null> => {
    try {
      const dados = await api.localCarregar();
      return dados && dados.versao === 1 && typeof dados.config === 'object' ? dados : null;
    } catch {
      return null;
    }
  },

  localSalvar: async (dados: DadosLocais): Promise<void> => {
    try {
      await api.localSalvar(dados);
    } catch {
      // persistência é melhor esforço
    }
  },

  // ---- sincronização dos dados locais com a planilha (proxy) ----
  dadosLocaisCarregar: (): Promise<
    { dados: DadosLocais | null; salvoEm: number } & { sucesso: true }
  > =>
    exigeSucesso(
      api.proxy(proxyPayload('dadosLocais', {})) as Promise<
        Resposta<{ dados: DadosLocais | null; salvoEm: number }>
      >,
    ),

  dadosLocaisSalvar: (
    dados: DadosLocais,
  ): Promise<{ salvoEm: number } & { sucesso: true }> =>
    exigeSucesso(
      api.proxy(proxyPayload('salvarDadosLocais', { dados })) as Promise<
        Resposta<{ salvoEm: number }>
      >,
    ),

  configResumo: async (): Promise<{ baseUrl: string; temChave: boolean } | null> => {
    try {
      return await api.configResumo();
    } catch {
      return null;
    }
  },
};
