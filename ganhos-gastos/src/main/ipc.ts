/**
 * Handlers IPC: expõe as chamadas da API ao renderer.
 * - Leituras rodam em paralelo; escritas passam pela fila (agendarEscrita).
 * - NUNCA rejeitam a promise: falhas voltam como { sucesso:false, erro, codigo }
 *   (mesmo formato da própria API), mantendo o contrato do app e o console limpo.
 */
import { ipcMain } from 'electron';
import type { PayloadEscrita } from '../types/api-electron';
import type { RespostaErro } from '../types/api-types';
import { carregarCache, flushCache, salvarCache } from './cacheStore';
import { carregarDadosLocais, flushDadosLocais, salvarDadosLocais } from './localStore';
import type { DadosLocais } from '../types/dados-locais';
import { obterConfig } from './config';
import { ErroApi, getJson, postJson, postJsonProxy } from './http';
import { agendarEscrita } from './fila';

/** Códigos previstos no contrato (api-types.ts). */
const CODIGOS_CONHECIDOS = new Set<RespostaErro['codigo']>([
  'ERRO_DESCONHECIDO', 'EXCECAO', 'NAO_AUTORIZADO', 'ACAO_INVALIDA',
  'PARAMETRO_AUSENTE', 'JSON_INVALIDO', 'ANO_INVALIDO', 'LOCK',
  'MODELO_AUSENTE', 'SEM_LINHA', 'SOMENTE_LEITURA', 'LINHA_INVALIDA',
  'NAO_ENCONTRADO', 'EMAIL_FALHOU', 'AGENDA_FALHOU',
  'TOKEN_INVALIDO', 'CREDENCIAIS_INVALIDAS', 'CONFIG_INVALIDA',
]);

function mapearCodigo(codigo: string | undefined): RespostaErro['codigo'] {
  if (codigo && CODIGOS_CONHECIDOS.has(codigo as RespostaErro['codigo'])) {
    return codigo as RespostaErro['codigo'];
  }
  if (codigo === 'LOGIN_GOOGLE' || codigo === 'NAO_AUTORIZADO') return 'NAO_AUTORIZADO';
  if (codigo === 'RESPOSTA_INVALIDA' || codigo === 'RESPOSTA_VAZIA') return 'JSON_INVALIDO';
  return 'ERRO_DESCONHECIDO';
}

async function proteger<T>(rotulo: string, operacao: () => Promise<T>): Promise<T | RespostaErro> {
  try {
    return await operacao();
  } catch (e) {
    const erro = e instanceof Error && e.message ? e.message : 'Erro inesperado no processo principal.';
    const codigo = e instanceof ErroApi ? mapearCodigo(e.codigo) : 'EXCECAO';
    console.error(`[api:${rotulo}]`, erro);
    return { sucesso: false, erro, codigo };
  }
}

export function registrarIpc(): void {
  // ---------- autenticação ----------
  ipcMain.handle('api:login', (_evento, payload) =>
    proteger('login', () => postJsonProxy(payload)),
  );
  ipcMain.handle('api:verificar', (_evento, payload) =>
    proteger('verificar', () => postJsonProxy(payload)),
  );

  // ---------- proxy (autenticado — token injetado na chamada real) ----------
  // Escritas via proxy entram na MESMA fila sequencial das escritas diretas:
  // duas gravacoes simultaneas podem provocar LOCK na planilha.
  const ACOES_ESCRITA = new Set([
    'adicionar', 'editar', 'remover', 'criarAno', 'atualizarDashboard',
    'adicionarLembrete', 'editarLembrete', 'removerLembrete',
    'testarLembrete', 'instalarLembretes', 'salvarDadosLocais',
  ]);
  ipcMain.handle('api:proxy', (_evento, payload: { acao_real?: string } & Record<string, unknown>) =>
    proteger('proxy', () => {
      const operacao = () => postJsonProxy(payload);
      return typeof payload?.acao_real === 'string' && ACOES_ESCRITA.has(payload.acao_real)
        ? agendarEscrita(operacao)
        : operacao();
    }),
  );

  // ---------- leituras ----------
  ipcMain.handle('api:abas', () => proteger('abas', () => getJson({ acao: 'abas' })));

  ipcMain.handle('api:ano', (_evento, ano: number) =>
    proteger('ano', () => {
      if (!Number.isInteger(ano)) throw new Error('Parâmetro "ano" inválido.');
      return getJson({ acao: 'ano', ano });
    }),
  );

  ipcMain.handle('api:dashboard', (_evento, ano: number, agrupar?: string) =>
    proteger('dashboard', () => {
      if (!Number.isInteger(ano)) throw new Error('Parâmetro "ano" inválido.');
      return getJson({ acao: 'dashboard', ano, agrupar });
    }),
  );

  ipcMain.handle('api:listas', () => proteger('listas', () => getJson({ acao: 'listas' })));

  ipcMain.handle('api:listar', (_evento, aba: string, tabela?: 'ganhos' | 'gastos') =>
    proteger('listar', () => {
      if (!aba) throw new Error('Parâmetro "aba" ausente.');
      return getJson({ acao: 'listar', aba, tabela });
    }),
  );

  // ---------- escritas (fila sequencial — evita LOCK na planilha) ----------
  ipcMain.handle('api:escrita', (_evento, payload: PayloadEscrita) =>
    proteger(`escrita:${payload?.acao ?? '?'}`, () => {
      if (!payload || typeof payload.acao !== 'string') {
        throw new Error('Payload de escrita inválido.');
      }
      return agendarEscrita(() => postJson(payload));
    }),
  );

  // ---------- cache em disco ----------
  ipcMain.handle('cache:carregar', () => proteger('cache:carregar', () => carregarCache()));
  ipcMain.handle('cache:salvar', (_evento, cache: Parameters<typeof salvarCache>[0]) =>
    proteger('cache:salvar', async () => {
      salvarCache(cache);
    }),
  );

  // ---------- diagnóstico (tela de status) ----------
  ipcMain.handle('config:resumo', () => {
    const { baseUrl, chave } = obterConfig();
    return { baseUrl, temChave: chave.length > 0 };
  });

  // ---------- dados locais (hora extra, férias, manutenção) ----------
  ipcMain.handle('local:carregar', () => proteger('local:carregar', () => carregarDadosLocais()));
  ipcMain.handle('local:salvar', (_evento, dados: DadosLocais) =>
    proteger('local:salvar', async () => {
      if (!dados || dados.versao !== 1) throw new Error('Dados locais inválidos.');
      salvarDadosLocais(dados);
    }),
  );
}

export function descarregarCachePendente(): void {
  flushCache();
  flushDadosLocais();
}
