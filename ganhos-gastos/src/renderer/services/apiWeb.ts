/**
 * Adaptador da API para a VERSÃO WEB (navegador).
 *
 * O app desktop fala com o processo principal do Electron via `window.api`
 * (preload). No navegador não existe `window.api`, então este arquivo
 * implementa o mesmo contrato usando `fetch` + `localStorage`.
 *
 * Detalhes importantes do Apps Script:
 *  - O POST precisa ir como `text/plain` para NÃO disparar preflight CORS.
 *  - O Apps Script responde 302 e o navegador segue sozinho para
 *    script.googleusercontent.com, que devolve o JSON com CORS liberado.
 *  - A API_KEY NUNCA fica no navegador: o proxy do Apps Script injeta a chave.
 */
import type {
  ApiElectron,
  CachePersistido,
  PayloadEscrita,
  PayloadLogin,
  PayloadVerificar,
} from '@/types/api-electron';
import type { DadosLocais } from '@/types/dados-locais';
import type {
  LoginResposta,
  Resposta,
  RespostaAbas,
  RespostaDashboard,
  RespostaListarExtra,
  RespostaListarMensal,
  RespostaListarSalario,
  RespostaListas,
  SnapshotAno,
  TokenResposta,
} from '@/types/api-types';

/** URL pública da implantação (pode ser trocada por VITE_API_URL no build). */
const URL_PADRAO =
  'https://script.google.com/macros/s/AKfycbwGtqZPUDzsPFhvEq6LItsqTqnMLDXIAYJIRl5Wp4CXAiEYQgS1gvZy3FTCWbg5NbA/exec';

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || URL_PADRAO;

const TIMEOUT_MS = 60_000;
const CACHE_KEY = 'gg_cache_v1';
const LOCAL_KEY = 'gg_dados_locais_v1';

async function comTimeout<T>(operacao: (sinal: AbortSignal) => Promise<T>): Promise<T> {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    return await operacao(controlador.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function lerJson(res: Response): Promise<unknown> {
  if (!res.ok) {
    throw new Error(`A API respondeu HTTP ${res.status}.`);
  }
  const texto = await res.text();
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error('A API não retornou um JSON válido.');
  }
}

async function postJson(corpo: Record<string, unknown>): Promise<unknown> {
  return comTimeout(async (signal) => {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      // text/plain evita o preflight CORS; o Apps Script lê e.postData.contents.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corpo),
      redirect: 'follow',
      signal,
    });
    return lerJson(res);
  });
}

async function getJson(params: Record<string, unknown>): Promise<unknown> {
  return comTimeout(async (signal) => {
    const url = new URL(BASE_URL);
    for (const [chave, valor] of Object.entries(params)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        url.searchParams.set(chave, String(valor));
      }
    }
    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal,
    });
    return lerJson(res);
  });
}

function lerLocalStorage<T>(chave: string): T | null {
  try {
    const texto = localStorage.getItem(chave);
    return texto ? (JSON.parse(texto) as T) : null;
  } catch {
    return null;
  }
}

function gravarLocalStorage(chave: string, valor: unknown): void {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // armazenamento cheio/indisponível — o app continua funcionando
  }
}

export function criarApiWeb(): ApiElectron {
  return {
    // Sem controles de janela: o navegador usa a moldura dele.
    janela: undefined,

    // ---- autenticação ----
    login: async (payload: PayloadLogin): Promise<LoginResposta> =>
      (await postJson(payload as unknown as Record<string, unknown>)) as LoginResposta,

    verificar: async (payload: PayloadVerificar): Promise<TokenResposta> =>
      (await postJson(payload as unknown as Record<string, unknown>)) as TokenResposta,

    proxy: async (payload: Record<string, unknown>): Promise<unknown> => postJson(payload),

    // ---- leituras (não usadas pelo renderer web) ----
    getAbas: (): Promise<RespostaAbas> =>
      getJson({ acao: 'abas' }) as Promise<RespostaAbas>,
    getAno: (ano: number): Promise<Resposta<SnapshotAno>> =>
      getJson({ acao: 'ano', ano }) as Promise<Resposta<SnapshotAno>>,
    getDashboard: (ano: number, agrupar?: string): Promise<RespostaDashboard> =>
      getJson({ acao: 'dashboard', ano, agrupar }) as Promise<RespostaDashboard>,
    getListas: (): Promise<RespostaListas> =>
      getJson({ acao: 'listas' }) as Promise<RespostaListas>,
    listar: (
      aba: string,
      tabela?: 'ganhos' | 'gastos',
    ): Promise<RespostaListarMensal | RespostaListarSalario | RespostaListarExtra> =>
      getJson({ acao: 'listar', aba, tabela }) as Promise<
        RespostaListarMensal | RespostaListarSalario | RespostaListarExtra
      >,

    // ---- escrita direta (não usada pelo renderer web) ----
    escrita: (payload: PayloadEscrita): Promise<never> => {
      void payload;
      return Promise.reject(new Error('[web] Use o proxy para escritas.'));
    },

    // ---- cache em localStorage ----
    cacheCarregar: async (): Promise<CachePersistido | null> =>
      lerLocalStorage<CachePersistido>(CACHE_KEY),
    cacheSalvar: async (cache: CachePersistido): Promise<void> => {
      gravarLocalStorage(CACHE_KEY, cache);
    },

    // ---- dados locais em localStorage ----
    localCarregar: async (): Promise<DadosLocais | null> =>
      lerLocalStorage<DadosLocais>(LOCAL_KEY),
    localSalvar: async (dados: DadosLocais): Promise<void> => {
      gravarLocalStorage(LOCAL_KEY, dados);
    },

    // ---- diagnóstico ----
    configResumo: async (): Promise<{ baseUrl: string; temChave: boolean }> => ({
      baseUrl: BASE_URL,
      temChave: false,
    }),
  };
}
