/**
 * Store principal — CACHE POR ANO (regra de ouro do app).
 *
 * - Uma única chamada `acao=ano` por ano; tudo o mais lê deste cache.
 * - Nenhum fetch ao montar abas: a troca de área é sempre instantânea.
 * - stale-while-revalidate: cache exibido na hora, requisição em segundo plano.
 * - Escritas são OTIMISTAS: estado local muda na hora; falha reverte + toast.
 * - O cache é persistido em disco pelo processo main (debounce).
 */
import { create } from 'zustand';
import type {
  DadosExtra,
  DadosMensais,
  DadosSalario,
  LancamentoMensal,
  LinhaExtra,
  MesSnapshot,
  PayloadEscrita,
  Registro,
  SiglaMes,
  SnapshotAno,
} from '@/types/api-types';
import type { CachePersistido, RespostaEscrita } from '@/types/api-electron';
import { arredondar2 } from '@/lib/formatar';
import { siglaDeAba } from '@/lib/meses';
import { msgDeErro, servicoApi } from '@/services/api';
import { useStoreAuth } from './storeAuth';
import { useStoreUI } from './storeUI';

type SalarioSnapshot = NonNullable<SnapshotAno['salario']>;
type ExtrasSnapshot = NonNullable<SnapshotAno['extras']>;
type TabelaExtra = 'ganhos' | 'gastos';
type RespostaSucesso = RespostaEscrita & { sucesso: true };

export interface EstadoAno {
  /** true assim que o cache em disco (ou a 1ª busca) for processado. */
  pronto: boolean;
  /** true APENAS quando não há nada a mostrar (1ª abertura sem cache / ano sem dados). */
  carregando: boolean;
  /** Revalidações em andamento (SWR) — indicador sutil, nunca bloqueia. */
  revalidacoes: number;
  /** Último erro de rede/API (mantém a UI utilizável). */
  erro: string | null;
  /** Escritas em voo (para o indicador de sincronização). */
  escritasPendentes: number;

  anos: number[];
  anoSelecionado: number | null;
  snapshots: Record<number, SnapshotAno>;
  atualizadoEm: Record<number, number>;
  listas: Record<string, string[]> | null;

  inicializar(): Promise<void>;
  /** Chamado após o login: busca anos e revalida o ano selecionado. */
  iniciarDados(): Promise<void>;
  selecionarAno(ano: number): Promise<void>;
  revalidar(ano?: number): Promise<void>;
  atualizarAnos(): Promise<void>;

  adicionarLancamento(ano: number, aba: string, dados: DadosMensais): Promise<boolean>;
  editarLancamento(
    ano: number,
    aba: string,
    linha: number,
    dados: DadosMensais,
  ): Promise<boolean>;
  removerLancamento(ano: number, aba: string, linha: number): Promise<boolean>;

  editarSalario(ano: number, linha: number, dados: DadosSalario): Promise<boolean>;

  adicionarExtra(ano: number, tabela: TabelaExtra, dados: DadosExtra): Promise<boolean>;
  editarExtra(
    ano: number,
    tabela: TabelaExtra,
    linha: number,
    dados: DadosExtra,
  ): Promise<boolean>;
  removerExtra(ano: number, tabela: TabelaExtra, linha: number): Promise<boolean>;

  criarNovoAno(ano: number): Promise<boolean>;
  gerarDashboard(ano: number): Promise<boolean>;
}

// ---------------------------------------------------------------------------
//  utilitários locais
// ---------------------------------------------------------------------------
let jaIniciou = false;
let timerPersistencia: ReturnType<typeof setTimeout> | null = null;

const ui = () => useStoreUI.getState();

function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

function persistir(): void {
  if (timerPersistencia) clearTimeout(timerPersistencia);
  timerPersistencia = setTimeout(() => {
    timerPersistencia = null;
    const s = useStoreAno.getState();
    const cache: CachePersistido = {
      versao: 1,
      salvoEm: Date.now(),
      anoSelecionado: s.anoSelecionado,
      anos: s.anos,
      snapshots: s.snapshots,
      atualizadoEm: s.atualizadoEm,
      listas: s.listas,
    };
    void servicoApi.cacheSalvar(cache);
  }, 900);
}

/** Aplica uma transformação em um mês específico do cache. */
function patchMes(ano: number, sigla: SiglaMes, fn: (m: MesSnapshot) => MesSnapshot): void {
  useStoreAno.setState((estado) => {
    const snapshot = estado.snapshots[ano];
    const mes = snapshot?.meses[sigla];
    if (!snapshot || !mes) return estado;
    return {
      snapshots: {
        ...estado.snapshots,
        [ano]: { ...snapshot, meses: { ...snapshot.meses, [sigla]: fn(mes) } },
      },
    };
  });
}

function restaurarMes(ano: number, sigla: SiglaMes, anterior: MesSnapshot | null): void {
  useStoreAno.setState((estado) => {
    const snapshot = estado.snapshots[ano];
    if (!snapshot) return estado;
    return {
      snapshots: {
        ...estado.snapshots,
        [ano]: { ...snapshot, meses: { ...snapshot.meses, [sigla]: anterior } },
      },
    };
  });
}

function patchSalario(ano: number, fn: (s: SalarioSnapshot) => SalarioSnapshot): void {
  useStoreAno.setState((estado) => {
    const snapshot = estado.snapshots[ano];
    if (!snapshot?.salario) return estado;
    return {
      snapshots: {
        ...estado.snapshots,
        [ano]: { ...snapshot, salario: fn(snapshot.salario) },
      },
    };
  });
}

function restaurarSalario(ano: number, anterior: SalarioSnapshot | null): void {
  useStoreAno.setState((estado) => {
    const snapshot = estado.snapshots[ano];
    if (!snapshot) return estado;
    return { snapshots: { ...estado.snapshots, [ano]: { ...snapshot, salario: anterior } } };
  });
}

function patchExtras(
  ano: number,
  tabela: TabelaExtra,
  fn: (registros: Registro<LinhaExtra>[]) => Registro<LinhaExtra>[],
): void {
  useStoreAno.setState((estado) => {
    const snapshot = estado.snapshots[ano];
    if (!snapshot?.extras) return estado;
    return {
      snapshots: {
        ...estado.snapshots,
        [ano]: {
          ...snapshot,
          extras: { ...snapshot.extras, [tabela]: fn(snapshot.extras[tabela]) },
        },
      },
    };
  });
}

function restaurarExtras(ano: number, anterior: ExtrasSnapshot | null): void {
  useStoreAno.setState((estado) => {
    const snapshot = estado.snapshots[ano];
    if (!snapshot) return estado;
    return { snapshots: { ...estado.snapshots, [ano]: { ...snapshot, extras: anterior } } };
  });
}

interface OpcaoEscrita {
  ano: number;
  payload: PayloadEscrita;
  /** Muda o estado local NA HORA. */
  otimizar(): void;
  /** Reverte ao estado anterior em caso de falha. */
  reverter(): void;
  aposSucesso?(resposta: RespostaSucesso): void;
  mensagemSucesso?: string;
}

/** Executa uma escrita com atualização otimista + rollback + toast. */
async function executarEscrita(op: OpcaoEscrita): Promise<boolean> {
  useStoreAno.setState({ escritasPendentes: useStoreAno.getState().escritasPendentes + 1 });
  op.otimizar();
  try {
    const resposta = await servicoApi.escrita(op.payload);
    op.aposSucesso?.(resposta);
    if (op.mensagemSucesso) ui().toast('sucesso', op.mensagemSucesso);
    persistir();
    return true;
  } catch (e) {
    op.reverter();
    ui().toast('erro', msgDeErro(e));
    // reconcilia o cache com a API em segundo plano
    void useStoreAno.getState().revalidar(op.ano);
    return false;
  } finally {
    const atual = useStoreAno.getState().escritasPendentes;
    useStoreAno.setState({ escritasPendentes: Math.max(0, atual - 1) });
  }
}

async function carregarListas(silencioso: boolean): Promise<void> {
  try {
    const resposta = await servicoApi.getListas();
    useStoreAno.setState({ listas: resposta.listas });
    persistir();
  } catch {
    // lista auxiliar: em caso de falha o app usa as constantes LISTAS de api-types
    if (!silencioso) {
      // nada a fazer — selects continuam com as opções embutidas
    }
  }
}

// ---------------------------------------------------------------------------
//  STORE
// ---------------------------------------------------------------------------
export const useStoreAno = create<EstadoAno>((set, get) => ({
  pronto: false,
  carregando: false,
  revalidacoes: 0,
  erro: null,
  escritasPendentes: 0,

  anos: [],
  anoSelecionado: null,
  snapshots: {},
  atualizadoEm: {},
  listas: null,

  inicializar: async () => {
    if (jaIniciou) return;
    jaIniciou = true;

    const token = useStoreAuth.getState().token;
    const cache = await servicoApi.cacheCarregar();

    if (cache && Object.keys(cache.snapshots).length > 0) {
      // CACHE EXISTE → mostra tudo imediatamente e revalida em segundo plano
      set({
        pronto: true,
        carregando: false,
        snapshots: cache.snapshots,
        anos: cache.anos,
        anoSelecionado: cache.anoSelecionado ?? (cache.anos.length ? cache.anos[cache.anos.length - 1] : null),
        atualizadoEm: cache.atualizadoEm,
        listas: cache.listas,
      });
      if (!token) return; // sem login: mostra o cache e espera o usuário entrar
      void get().revalidar();
      void get().atualizarAnos();
      void carregarListas(true);
      return;
    }

    // Sem cache e sem login: não chama a API (evita erro na tela de login).
    if (!token) {
      set({ pronto: true, carregando: false });
      return;
    }

    // ÚNICO loading bloqueante do app: primeira abertura sem cache
    set({ pronto: true, carregando: true });
    await get().atualizarAnos();
    const anos = get().anos;
    const ano = anos.length ? anos[anos.length - 1] : null;

    if (ano != null) {
      set({ anoSelecionado: ano });
      await get().revalidar(ano);
    } else if (!get().erro) {
      set({ erro: 'Nenhum ano/aba encontrado na API.' });
    }
    set({ carregando: false });
    void carregarListas(true);
  },

  iniciarDados: async () => {
    // Chamado após o login: garante anos + ano selecionado carregados.
    if (get().anos.length === 0) {
      await get().atualizarAnos();
    }
    const anos = get().anos;
    const ano = get().anoSelecionado ?? (anos.length ? anos[anos.length - 1] : null);

    if (ano != null) {
      if (get().anoSelecionado !== ano) {
        await get().selecionarAno(ano);
      } else {
        await get().revalidar(ano);
      }
    } else if (!get().erro) {
      set({ erro: 'Nenhum ano/aba encontrado na API.' });
    }
    void carregarListas(true);
  },

  selecionarAno: async (ano) => {
    if (ano === get().anoSelecionado) return;
    const existente = get().snapshots[ano];
    set({ anoSelecionado: ano });
    persistir();

    if (existente) {
      // cache do ano já existe → mostra na hora e revalida em silêncio
      const mes = useStoreUI.getState().mes;
      if (!existente.meses[mes]) {
        const primeiroComDados = (Object.keys(existente.meses) as SiglaMes[]).find(
          (s) => existente.meses[s],
        );
        if (primeiroComDados) useStoreUI.getState().setMes(primeiroComDados);
      }
      void get().revalidar(ano);
      return;
    }

    set({ carregando: true });
    await get().revalidar(ano);
    set({ carregando: false });
  },

  revalidar: async (anoPretendido) => {
    const alvo = anoPretendido ?? get().anoSelecionado;
    if (alvo == null) return;

    set({ revalidacoes: get().revalidacoes + 1 });
    try {
      const snapshot = await servicoApi.getAno(alvo);
      set((estado) => ({
        snapshots: { ...estado.snapshots, [alvo]: snapshot },
        atualizadoEm: { ...estado.atualizadoEm, [alvo]: Date.now() },
        carregando: false,
        erro: null,
      }));
      persistir();
    } catch (e) {
      const mensagem = msgDeErro(e);
      if (get().erro !== mensagem) ui().toast('erro', mensagem);
      set({ erro: mensagem, carregando: false });
    } finally {
      set({ revalidacoes: Math.max(0, get().revalidacoes - 1) });
    }
  },

  atualizarAnos: async () => {
    try {
      const resposta = await servicoApi.getAbas();
      const anos = Array.from(
        new Set(resposta.abas.filter((a) => a.ano !== null).map((a) => a.ano as number)),
      ).sort((a, b) => a - b);
      set({ anos, erro: null });
      persistir();
    } catch (e) {
      const mensagem = msgDeErro(e);
      if (get().erro !== mensagem) ui().toast('erro', mensagem);
      set({ erro: mensagem });
    }
  },

  // -------------------------------------------------------------------------
  //  LANÇAMENTOS MENSAIS
  // -------------------------------------------------------------------------
  adicionarLancamento: async (ano, aba, dados) => {
    const sigla = siglaDeAba(aba);
    const mes = get().snapshots[ano]?.meses[sigla];
    if (!mes) {
      ui().toast('erro', `A aba "${aba}" não está disponível para o ano ${ano}.`);
      return false;
    }
    const anterior = clonar(mes);
    const tempLinha = -(Math.floor(Math.random() * 1_000_000_000) + 1);
    const registroTemporario: Registro<LancamentoMensal> = {
      linha: tempLinha,
      dados: dados as LancamentoMensal,
    };
    const valor = Number(dados.VALOR) || 0;

    return executarEscrita({
      ano,
      payload: { acao: 'adicionar', aba, dados },
      otimizar: () =>
        patchMes(ano, sigla, (m) => ({
          ...m,
          registros: [...m.registros, registroTemporario],
          totalLancado: arredondar2(m.totalLancado + valor),
        })),
      reverter: () => restaurarMes(ano, sigla, anterior),
      aposSucesso: (resposta) => {
        if (!('linha' in resposta) || typeof resposta.linha !== 'number') return;
        const linhaReal = resposta.linha;
        const dadosConfirmados =
          'registro' in resposta && resposta.registro
            ? (resposta.registro as LancamentoMensal)
            : (dados as LancamentoMensal);
        patchMes(ano, sigla, (m) => ({
          ...m,
          registros: m.registros.map((r) =>
            r.linha === tempLinha ? { linha: linhaReal, dados: dadosConfirmados } : r,
          ),
        }));
      },
      mensagemSucesso: 'Lançamento adicionado.',
    });
  },

  editarLancamento: async (ano, aba, linha, dados) => {
    const sigla = siglaDeAba(aba);
    const mes = get().snapshots[ano]?.meses[sigla];
    if (!mes) {
      ui().toast('erro', `A aba "${aba}" não está disponível para o ano ${ano}.`);
      return false;
    }
    const anterior = clonar(mes);

    return executarEscrita({
      ano,
      payload: { acao: 'editar', aba, linha, dados },
      otimizar: () =>
        patchMes(ano, sigla, (m) => {
          const registro = m.registros.find((r) => r.linha === linha);
          const antigo = Number(registro?.dados.VALOR ?? 0);
          const novo = dados.VALOR !== undefined ? Number(dados.VALOR) : NaN;
          const total =
            registro && Number.isFinite(novo) && novo !== antigo
              ? arredondar2(m.totalLancado - antigo + novo)
              : m.totalLancado;
          return {
            ...m,
            registros: m.registros.map((r) =>
              r.linha === linha ? { ...r, dados: { ...r.dados, ...dados } } : r,
            ),
            totalLancado: total,
          };
        }),
      reverter: () => restaurarMes(ano, sigla, anterior),
      mensagemSucesso: 'Registro atualizado.',
    });
  },

  removerLancamento: async (ano, aba, linha) => {
    const sigla = siglaDeAba(aba);
    const mes = get().snapshots[ano]?.meses[sigla];
    if (!mes) {
      ui().toast('erro', `A aba "${aba}" não está disponível para o ano ${ano}.`);
      return false;
    }
    const anterior = clonar(mes);
    const removido = mes.registros.find((r) => r.linha === linha);
    const valor = Number(removido?.dados.VALOR ?? 0);

    return executarEscrita({
      ano,
      payload: { acao: 'remover', aba, linha },
      otimizar: () =>
        patchMes(ano, sigla, (m) => ({
          ...m,
          registros: m.registros.filter((r) => r.linha !== linha),
          totalLancado: arredondar2(m.totalLancado - valor),
        })),
      reverter: () => restaurarMes(ano, sigla, anterior),
      mensagemSucesso: 'Registro removido.',
    });
  },

  // -------------------------------------------------------------------------
  //  SALÁRIO (nunca envia colunas calculadas)
  // -------------------------------------------------------------------------
  editarSalario: async (ano, linha, dados) => {
    const salario = get().snapshots[ano]?.salario;
    if (!salario) {
      ui().toast('erro', `A aba de salário do ano ${ano} não existe.`);
      return false;
    }
    const anterior = clonar(salario);

    return executarEscrita({
      ano,
      payload: { acao: 'editar', aba: salario.aba, linha, dados },
      otimizar: () =>
        patchSalario(ano, (s) => ({
          ...s,
          registros: s.registros.map((r) =>
            r.linha === linha ? { ...r, dados: { ...r.dados, ...dados } } : r,
          ),
        })),
      reverter: () => restaurarSalario(ano, anterior),
      mensagemSucesso: 'Salário atualizado.',
    });
  },

  // -------------------------------------------------------------------------
  //  EXTRAS (ganhos e gastos — sempre envia "tabela")
  // -------------------------------------------------------------------------
  adicionarExtra: async (ano, tabela, dados) => {
    const extras = get().snapshots[ano]?.extras;
    if (!extras) {
      ui().toast('erro', `A aba de extras do ano ${ano} não existe.`);
      return false;
    }
    const anterior = clonar(extras);
    const tempLinha = -(Math.floor(Math.random() * 1_000_000_000) + 1);
    const registroTemporario: Registro<LinhaExtra> = {
      linha: tempLinha,
      dados: dados as LinhaExtra,
    };

    return executarEscrita({
      ano,
      payload: { acao: 'adicionar', aba: extras.aba, tabela, dados },
      otimizar: () => patchExtras(ano, tabela, (lista) => [...lista, registroTemporario]),
      reverter: () => restaurarExtras(ano, anterior),
      aposSucesso: (resposta) => {
        if (!('linha' in resposta) || typeof resposta.linha !== 'number') return;
        const linhaReal = resposta.linha;
        const dadosConfirmados =
          'registro' in resposta && resposta.registro
            ? (resposta.registro as LinhaExtra)
            : (dados as LinhaExtra);
        patchExtras(ano, tabela, (lista) =>
          lista.map((r) => (r.linha === tempLinha ? { linha: linhaReal, dados: dadosConfirmados } : r)),
        );
      },
      mensagemSucesso: 'Registro de extra adicionado.',
    });
  },

  editarExtra: async (ano, tabela, linha, dados) => {
    const extras = get().snapshots[ano]?.extras;
    if (!extras) {
      ui().toast('erro', `A aba de extras do ano ${ano} não existe.`);
      return false;
    }
    const anterior = clonar(extras);

    return executarEscrita({
      ano,
      payload: { acao: 'editar', aba: extras.aba, linha, dados, tabela },
      otimizar: () =>
        patchExtras(ano, tabela, (lista) =>
          lista.map((r) => (r.linha === linha ? { ...r, dados: { ...r.dados, ...dados } } : r)),
        ),
      reverter: () => restaurarExtras(ano, anterior),
      mensagemSucesso: 'Registro de extra atualizado.',
    });
  },

  removerExtra: async (ano, tabela, linha) => {
    const extras = get().snapshots[ano]?.extras;
    if (!extras) {
      ui().toast('erro', `A aba de extras do ano ${ano} não existe.`);
      return false;
    }
    const anterior = clonar(extras);

    return executarEscrita({
      ano,
      payload: { acao: 'remover', aba: extras.aba, linha, tabela },
      otimizar: () => patchExtras(ano, tabela, (lista) => lista.filter((r) => r.linha !== linha)),
      reverter: () => restaurarExtras(ano, anterior),
      mensagemSucesso: 'Registro de extra removido.',
    });
  },

  // -------------------------------------------------------------------------
  //  ANOS
  // -------------------------------------------------------------------------
  criarNovoAno: async (ano) => {
    useStoreAno.setState({ escritasPendentes: get().escritasPendentes + 1 });
    try {
      const resposta = await servicoApi.escrita({ acao: 'criarAno', ano });
      const detalhe =
        'aviso' in resposta && resposta.aviso ? ` — ${resposta.aviso}` : '';
      ui().toast('sucesso', `Ano ${ano} criado${detalhe}.`);
      await get().atualizarAnos();
      persistir();
      return true;
    } catch (e) {
      ui().toast('erro', msgDeErro(e));
      return false;
    } finally {
      set({ escritasPendentes: Math.max(0, get().escritasPendentes - 1) });
    }
  },

  gerarDashboard: async (ano) => {
    useStoreAno.setState({ escritasPendentes: get().escritasPendentes + 1 });
    try {
      const resposta = await servicoApi.escrita({ acao: 'atualizarDashboard', ano });
      const total = 'totalGeral' in resposta ? resposta.totalGeral : undefined;
      ui().toast(
        'sucesso',
        `Dashboard de ${ano} gerado na planilha${
          typeof total === 'number' ? ` (total ${total})` : ''
        }.`,
      );
      // o resumo local pode ter mudado → revalida em segundo plano
      void get().revalidar(ano);
      return true;
    } catch (e) {
      ui().toast('erro', msgDeErro(e));
      return false;
    } finally {
      set({ escritasPendentes: Math.max(0, get().escritasPendentes - 1) });
    }
  },
}));
