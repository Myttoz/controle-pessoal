/**
 * Camada HTTP da API (processo main).
 *
 * - Timeout de 60s (cold start do Apps Script pode levar ~30s na 1ª chamada).
 * - Leituras (GET): retry com backoff exponencial em falha de rede/timeout/5xx.
 * - Escritas (POST): retry APENAS quando a API responde codigo "LOCK"
 *   (nesse caso a escrita NÃO foi aplicada — é seguro repetir). Repetir uma
 *   escrita após falha de rede poderia duplicar o registro.
 * - Detecta redirecionamento para login do Google e respostas que não são JSON.
 */
import type { PayloadEscrita } from '../types/api-electron';
import { obterConfig } from './config';

const TIMEOUT_MS = 60_000;
const MAX_TENTATIVAS_LEITURA = 3;
const MAX_TENTATIVAS_LOCK = 3;

export class ErroApi extends Error {
  readonly codigo?: string;

  constructor(mensagem: string, codigo?: string) {
    super(mensagem);
    this.name = 'ErroApi';
    this.codigo = codigo;
  }
}

const dormir = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Backoff exponencial: ~0.8s, ~1.6s, ~3.2s (com jitter). */
function backoff(tentativa: number): number {
  return 800 * 2 ** tentativa + Math.random() * 400;
}

function ehErroDeRede(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || e.name === 'TypeError' || e.name === 'FetchError');
}

async function buscar(url: string, init: RequestInit): Promise<Response> {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controlador.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST seguindo redirecionamentos MANUALMENTE.
 *
 * O Apps Script responde 302 apontando para script.googleusercontent.com/macros/echo,
 * que devolve o resultado da escrita. Esse segundo salto aceita APENAS GET:
 * reenviar POST (como fazia este app) retorna HTTP 405 em HTML — e a escrita,
 * já executada no primeiro salto, "parecia" falhar.
 * Por isso: 301/302/303 viram GET sem corpo; 307/308 preservam POST + corpo.
 */
async function postSeguindoRedirect(url: string, init: RequestInit): Promise<Response> {
  const MAX_SALTOS = 3;
  let destino = url;
  let metodo = 'POST';

  for (let salto = 0; salto <= MAX_SALTOS; salto++) {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(destino, {
        method: metodo,
        headers: metodo === 'POST' ? init.headers : undefined,
        body: metodo === 'POST' ? init.body : undefined,
        signal: controlador.signal,
        redirect: 'manual',
      });
    } finally {
      clearTimeout(timer);
    }

    const redirecionamento = res.status >= 300 && res.status < 400;
    if (!redirecionamento) return res;

    const local = res.headers.get('location');
    if (!local) return res;
    // descarta o corpo da resposta 3xx antes do próximo salto
    await res.arrayBuffer().catch(() => undefined);
    destino = new URL(local, destino).toString();

    if (res.status !== 307 && res.status !== 308) {
      metodo = 'GET';
    }
  }

  throw new ErroApi('A API fez redirecionamentos demais.', 'RESPOSTA_INVALIDA');
}

async function lerJson(res: Response): Promise<unknown> {
  // Apps Script sem acesso público redireciona para o login do Google.
  if (res.url.includes('accounts.google.com') || res.url.includes('ServiceLogin')) {
    throw new ErroApi(
      'A API exigiu login do Google. A implantação do Apps Script precisa estar com ' +
        '"Quem tem acesso: Qualquer pessoa" (Implantar → Gerenciar implantações).',
      'LOGIN_GOOGLE',
    );
  }

  const texto = await res.text();

  let json: unknown;
  try {
    json = texto.trim() ? JSON.parse(texto) : null;
  } catch {
    if (res.status === 401 || res.status === 403) {
      throw new ErroApi(
        `Não autorizado (HTTP ${res.status}). Verifique a API_KEY no arquivo .env.`,
        'NAO_AUTORIZADO',
      );
    }
    throw new ErroApi(
      `A API respondeu algo que não é JSON (HTTP ${res.status}). Verifique a URL base (.env) ` +
        'e o acesso público da implantação.',
      'RESPOSTA_INVALIDA',
    );
  }

  if (json === null) {
    throw new ErroApi('A API retornou uma resposta vazia.', 'RESPOSTA_VAZIA');
  }
  return json;
}

/** GET com retry/backoff. */
export async function getJson(
  params: Record<string, string | number | undefined>,
): Promise<unknown> {
  const { baseUrl, chave } = obterConfig();
  const busca = new URLSearchParams();
  for (const [chave2, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') busca.set(chave2, String(valor));
  }
  if (chave) busca.set('chave', chave);

  const url = `${baseUrl}?${busca.toString()}`;
  let ultimoErro: unknown = null;

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_LEITURA; tentativa++) {
    try {
      const res = await buscar(url, { method: 'GET' });
      if (res.status >= 500) {
        throw new ErroApi(`A API falhou com HTTP ${res.status}.`, 'HTTP_5XX');
      }
      return await lerJson(res);
    } catch (e) {
      ultimoErro = e;
      const retentavel =
        ehErroDeRede(e) || (e instanceof ErroApi && (e.codigo === 'HTTP_5XX' || e.codigo === undefined));
      if (!retentavel || tentativa === MAX_TENTATIVAS_LEITURA - 1) break;
      await dormir(backoff(tentativa));
    }
  }

  if (ultimoErro instanceof Error) {
    if (ehErroDeRede(ultimoErro) && ultimoErro.name === 'AbortError') {
      throw new ErroApi(
        'Tempo esgotado (60s). A 1ª chamada pode demorar até ~30s por cold start do Apps Script.',
        'TIMEOUT',
      );
    }
    if (ehErroDeRede(ultimoErro)) {
      throw new ErroApi('Falha de conexão com a API. Verifique sua rede.', 'SEM_REDE');
    }
    throw ultimoErro;
  }
  throw new ErroApi('Falha desconhecida ao consultar a API.', 'ERRO_DESCONHECIDO');
}

/** POST (escrita). Retry somente em codigo LOCK (escrita não aplicada). */
export async function postJson(payload: PayloadEscrita): Promise<unknown> {
  const { baseUrl, chave } = obterConfig();
  const corpo = JSON.stringify(chave ? { ...payload, chave } : payload);

  let ultimoErro: unknown = null;

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_LOCK; tentativa++) {
    try {
      const res = await postSeguindoRedirect(baseUrl, {
        method: 'POST',
        // text/plain evita o preflight CORS do Apps Script
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: corpo,
      });
      if (res.status >= 500) {
        throw new ErroApi(`A API falhou com HTTP ${res.status}.`, 'HTTP_5XX');
      }
      const json = await lerJson(res);

      const bloqueio =
        typeof json === 'object' &&
        json !== null &&
        (json as { sucesso?: unknown }).sucesso === false &&
        (json as { codigo?: string }).codigo === 'LOCK';

      if (bloqueio && tentativa < MAX_TENTATIVAS_LOCK - 1) {
        await dormir(backoff(tentativa));
        continue;
      }
      return json;
    } catch (e) {
      ultimoErro = e;
      // Escritas não são repetidas em erro de rede (risco de duplicar).
      if (!(e instanceof ErroApi && (e.codigo === 'HTTP_5XX' || e.codigo === undefined))) break;
      if (tentativa === MAX_TENTATIVAS_LOCK - 1) break;
      await dormir(backoff(tentativa));
    }
  }

  if (ultimoErro instanceof ErroApi) throw ultimoErro;
  if (ultimoErro instanceof Error && ultimoErro.name === 'AbortError') {
    throw new ErroApi(
      'Tempo esgotado (60s) ao gravar. A 1ª chamada pode demorar até ~30s por cold start.',
      'TIMEOUT',
    );
  }
  if (ultimoErro instanceof Error && ehErroDeRede(ultimoErro)) {
    throw new ErroApi(
      'Falha de conexão ao gravar. Verifique sua rede e tente novamente.',
      'SEM_REDE',
    );
  }
  throw ultimoErro instanceof Error
    ? ultimoErro
    : new ErroApi('Falha desconhecida ao gravar.', 'ERRO_DESCONHECIDO');
}

/**
 * POST com corpo JSON (application/json) para autenticação e proxy.
 * Usado por login, verificar e proxy — diferentemente de postJson que envia
 * text/plain para escritas na planilha.
 */
export async function postJsonProxy(
  corpo: Record<string, unknown>,
): Promise<unknown> {
  const { baseUrl } = obterConfig();
  const texto = JSON.stringify(corpo);

  let ultimoErro: unknown = null;

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const res = await buscar(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: texto,
      });
      if (res.status >= 500) {
        throw new ErroApi(`A API falhou com HTTP ${res.status}.`, 'HTTP_5XX');
      }
      const json = await lerJson(res);

      // Escritas via proxy podem pegar LOCK da planilha — repete como o postJson.
      const bloqueio =
        typeof json === 'object' &&
        json !== null &&
        (json as { sucesso?: unknown }).sucesso === false &&
        (json as { codigo?: string }).codigo === 'LOCK';
      if (bloqueio && tentativa < 2) {
        await dormir(backoff(tentativa));
        continue;
      }
      return json;
    } catch (e) {
      ultimoErro = e;
      const retentavel =
        ehErroDeRede(e) || (e instanceof ErroApi && e.codigo === 'HTTP_5XX');
      if (!retentavel || tentativa === 2) break;
      await dormir(backoff(tentativa));
    }
  }

  if (ultimoErro instanceof ErroApi) throw ultimoErro;
  if (ultimoErro instanceof Error && ultimoErro.name === 'AbortError') {
    throw new ErroApi(
      'Tempo esgotado (60s) ao autenticar. A 1ª chamada pode demorar até ~30s por cold start.',
      'TIMEOUT',
    );
  }
  if (ultimoErro instanceof Error && ehErroDeRede(ultimoErro)) {
    throw new ErroApi(
      'Falha de conexão ao autenticar. Verifique sua rede.',
      'SEM_REDE',
    );
  }
  throw ultimoErro instanceof Error
    ? ultimoErro
    : new ErroApi('Falha desconhecida ao autenticar.', 'ERRO_DESCONHECIDO');
}
