/**
 * Store dos DADOS LOCAIS (hora extra, férias, manutenção e configuração).
 *
 * Antes estes dados existiam apenas no dispositivo. Agora eles são:
 *   1. salvos localmente (disco no Electron / localStorage na web);
 *   2. sincronizados com a planilha pela ação `salvarDadosLocais` do proxy;
 *   3. mantidos em uma fila simples quando o dispositivo está sem internet.
 *
 * Regra de conflito: a última gravação vence (last-write-wins). Para uso
 * pessoal em poucos dispositivos isso é suficiente. O botão de exportar
 * backup gera um JSON que pode ser importado em qualquer versão.
 */
import { create } from 'zustand';
import type {
  ConfigLocal,
  DadosLocais,
  RegistroFerias,
  RegistroHoraExtra,
  RegistroManutencao,
} from '@/types/dados-locais';
import { dadosLocaisVazios } from '@/types/dados-locais';
import { msgDeErro, servicoApi } from '@/services/api';
import { useStoreAuth } from './storeAuth';
import { useStoreUI } from './storeUI';

const PENDENTE_KEY = 'gg_sync_pendente';
const ULTIMA_SYNC_KEY = 'gg_ultima_sync';
const DEBOUNCE_SYNC_MS = 1200;

interface EstadoLocal {
  pronto: boolean;
  dados: DadosLocais;
  /** true quando já existe um arquivo/localStorage com dados neste dispositivo. */
  temLocal: boolean;
  sincronizando: boolean;
  /** true quando há alterações que ainda não chegaram ao servidor. */
  pendente: boolean;
  ultimaSincronizacao: number | null;
  erroSync: string | null;

  inicializar(): Promise<void>;
  /** Envia/recebe os dados locais. `manual` mostra toasts de resultado. */
  sincronizar(manual?: boolean): Promise<void>;

  setConfig(parcial: Partial<ConfigLocal>): void;

  adicionarHoraExtra(registro: Omit<RegistroHoraExtra, 'id'>): void;
  editarHoraExtra(id: string, parcial: Partial<RegistroHoraExtra>): void;
  removerHoraExtra(id: string): void;

  adicionarFerias(registro: Omit<RegistroFerias, 'id'>): void;
  editarFerias(id: string, parcial: Partial<RegistroFerias>): void;
  removerFerias(id: string): void;

  adicionarManutencao(registro: Omit<RegistroManutencao, 'id'>): void;
  editarManutencao(id: string, parcial: Partial<RegistroManutencao>): void;
  removerManutencao(id: string): void;

  /** Gera e baixa um arquivo JSON com todos os dados locais. */
  exportarBackup(): void;
  /** Importa um arquivo gerado por `exportarBackup`. */
  importarBackup(texto: string): Promise<{ ok: boolean; mensagem: string }>;
}

let jaIniciou = false;
let timerSync: ReturnType<typeof setTimeout> | null = null;

function novoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Garante que o objeto tenha todas as listas/config no formato esperado. */
function normalizar(carregado: DadosLocais | null | undefined): DadosLocais | null {
  if (!carregado || carregado.versao !== 1 || typeof carregado.config !== 'object') {
    return null;
  }
  const base = dadosLocaisVazios();
  return {
    ...base,
    ...carregado,
    config: { ...base.config, ...carregado.config },
    horasExtras: Array.isArray(carregado.horasExtras) ? carregado.horasExtras : [],
    ferias: Array.isArray(carregado.ferias) ? carregado.ferias : [],
    manutencoes: Array.isArray(carregado.manutencoes) ? carregado.manutencoes : [],
  };
}

/** true quando não há nenhum registro nem configuração preenchida. */
function estaVazio(dados: DadosLocais): boolean {
  return (
    dados.horasExtras.length === 0 &&
    dados.ferias.length === 0 &&
    dados.manutencoes.length === 0 &&
    !dados.config.salarioBruto &&
    !dados.config.kmAtual
  );
}

function lerPendente(): boolean {
  try {
    return localStorage.getItem(PENDENTE_KEY) === '1';
  } catch {
    return false;
  }
}

function marcarPendente(): void {
  try {
    localStorage.setItem(PENDENTE_KEY, '1');
  } catch {
    // armazenamento indisponível
  }
}

function limparPendente(): void {
  try {
    localStorage.removeItem(PENDENTE_KEY);
  } catch {
    // armazenamento indisponível
  }
}

function lerUltimaSync(): number | null {
  try {
    const valor = localStorage.getItem(ULTIMA_SYNC_KEY);
    return valor ? Number(valor) || null : null;
  } catch {
    return null;
  }
}

function gravarUltimaSync(ts: number): void {
  try {
    localStorage.setItem(ULTIMA_SYNC_KEY, String(ts));
  } catch {
    // armazenamento indisponível
  }
}

function toast(tipo: 'sucesso' | 'erro', texto: string): void {
  useStoreUI.getState().toast(tipo, texto);
}

/** Agenda um envio em segundo plano (debounce para não gravar a cada tecla). */
function agendarSync(): void {
  if (timerSync) clearTimeout(timerSync);
  timerSync = setTimeout(() => {
    timerSync = null;
    void useStoreLocal.getState().sincronizar();
  }, DEBOUNCE_SYNC_MS);
}

/** Aplica uma transformação, salva localmente e agenda a sincronização. */
function mutar(fn: (dados: DadosLocais) => DadosLocais): void {
  useStoreLocal.setState((estado) => {
    const dados: DadosLocais = {
      ...fn(estado.dados),
      versao: 1,
      salvoEm: Date.now(),
    };
    void servicoApi.localSalvar(dados);
    marcarPendente();
    agendarSync();
    return { dados, temLocal: true, pendente: true };
  });
}

export const useStoreLocal = create<EstadoLocal>((set, get) => {
  /** Adota os dados vindos do servidor e grava localmente. */
  async function adotarRemoto(remoto: DadosLocais, manual: boolean): Promise<void> {
    const dados = normalizar(remoto);
    if (!dados) return;
    set({
      dados,
      temLocal: true,
      pendente: false,
      ultimaSincronizacao: Date.now(),
      erroSync: null,
    });
    await servicoApi.localSalvar(dados);
    limparPendente();
    gravarUltimaSync(Date.now());
    if (manual) toast('sucesso', 'Dados atualizados a partir do servidor.');
  }

  return {
    pronto: false,
    dados: dadosLocaisVazios(),
    temLocal: false,
    sincronizando: false,
    pendente: false,
    ultimaSincronizacao: null,
    erroSync: null,

    inicializar: async () => {
      if (jaIniciou) return;
      jaIniciou = true;

      const carregado = await servicoApi.localCarregar();
      const normalizado = normalizar(carregado);
      const dados = normalizado ?? dadosLocaisVazios();

      set({
        dados,
        pronto: true,
        temLocal: !!normalizado,
        pendente: lerPendente(),
        ultimaSincronizacao: lerUltimaSync(),
      });

      // Em segundo plano: se houver login, busca o servidor.
      void get().sincronizar();
    },

    sincronizar: async (manual = false) => {
      if (get().sincronizando) return;

      const token = useStoreAuth.getState().token;
      if (!token) {
        if (manual) toast('erro', 'Faça login para sincronizar.');
        return;
      }

      set({ sincronizando: true, erroSync: null });
      try {
        const remoto = await servicoApi.dadosLocaisCarregar();
        const local = get().dados;
        const remotoDados = normalizar(remoto.dados);
        const remotoSalvoEm = Number(remoto.salvoEm) || Number(remotoDados?.salvoEm) || 0;
        const localSalvoEm = Number(local.salvoEm) || 0;
        const pendente = lerPendente() || get().pendente;
        const localVazio = estaVazio(local);

        if (remotoDados && !pendente && (!get().temLocal || localVazio)) {
          // Primeira abertura neste dispositivo (ou dados locais ainda vazios):
          // o servidor manda. Isso evita que um arquivo local vazio criado
          // antes desta atualização apague os dados que já estão na planilha.
          await adotarRemoto(remotoDados, manual);
        } else if (!remotoDados || pendente || localSalvoEm > remotoSalvoEm) {
          // Há alterações locais (ou o servidor está vazio): envia.
          const enviadoEm = localSalvoEm;
          await servicoApi.dadosLocaisSalvar(local);
          limparPendente();
          gravarUltimaSync(Date.now());
          set({ pendente: false, ultimaSincronizacao: Date.now() });

          // Se o usuário editou durante o envio, agenda outro.
          if (get().dados.salvoEm !== enviadoEm) agendarSync();
          if (manual) toast('sucesso', 'Dados enviados para o servidor.');
        } else if (remotoDados && remotoSalvoEm > localSalvoEm) {
          // O servidor está mais novo: adota.
          await adotarRemoto(remotoDados, manual);
        } else {
          limparPendente();
          gravarUltimaSync(Date.now());
          set({ pendente: false, ultimaSincronizacao: Date.now() });
          if (manual) toast('sucesso', 'Tudo já estava sincronizado.');
        }
      } catch (e) {
        const mensagem = msgDeErro(e);
        set({ erroSync: mensagem, pendente: lerPendente() });
        if (manual) toast('erro', `Não foi possível sincronizar: ${mensagem}`);
      } finally {
        set({ sincronizando: false });
      }
    },

    setConfig: (parcial) =>
      mutar((d) => ({ ...d, config: { ...d.config, ...parcial } })),

    // -----------------------------------------------------------------------
    //  HORA EXTRA
    // -----------------------------------------------------------------------
    adicionarHoraExtra: (registro) => {
      mutar((d) => ({
        ...d,
        horasExtras: [...d.horasExtras, { ...registro, id: novoId() }],
      }));
      toast('sucesso', 'Plantão registrado.');
    },
    editarHoraExtra: (id, parcial) =>
      mutar((d) => ({
        ...d,
        horasExtras: d.horasExtras.map((r) => (r.id === id ? { ...r, ...parcial } : r)),
      })),
    removerHoraExtra: (id) => {
      mutar((d) => ({ ...d, horasExtras: d.horasExtras.filter((r) => r.id !== id) }));
      toast('sucesso', 'Plantão removido.');
    },

    // -----------------------------------------------------------------------
    //  FÉRIAS
    // -----------------------------------------------------------------------
    adicionarFerias: (registro) => {
      mutar((d) => ({ ...d, ferias: [...d.ferias, { ...registro, id: novoId() }] }));
      toast('sucesso', 'Retirada de férias registrada.');
    },
    editarFerias: (id, parcial) =>
      mutar((d) => ({
        ...d,
        ferias: d.ferias.map((r) => (r.id === id ? { ...r, ...parcial } : r)),
      })),
    removerFerias: (id) => {
      mutar((d) => ({ ...d, ferias: d.ferias.filter((r) => r.id !== id) }));
      toast('sucesso', 'Registro de férias removido.');
    },

    // -----------------------------------------------------------------------
    //  MANUTENÇÃO
    // -----------------------------------------------------------------------
    adicionarManutencao: (registro) => {
      mutar((d) => ({
        ...d,
        manutencoes: [...d.manutencoes, { ...registro, id: novoId() }],
      }));
      toast('sucesso', 'Manutenção registrada.');
    },
    editarManutencao: (id, parcial) =>
      mutar((d) => ({
        ...d,
        manutencoes: d.manutencoes.map((r) => (r.id === id ? { ...r, ...parcial } : r)),
      })),
    removerManutencao: (id) => {
      mutar((d) => ({ ...d, manutencoes: d.manutencoes.filter((r) => r.id !== id) }));
      toast('sucesso', 'Manutenção removida.');
    },

    // -----------------------------------------------------------------------
    //  BACKUP (arquivo único para pendrive / nuvem)
    // -----------------------------------------------------------------------
    exportarBackup: () => {
      const pacote = {
        tipo: 'controle-pessoal-backup',
        versao: 1,
        exportadoEm: new Date().toISOString(),
        dadosLocais: get().dados,
      };
      const blob = new Blob([JSON.stringify(pacote, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `controle-pessoal-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('sucesso', 'Backup exportado.');
    },

    importarBackup: async (texto) => {
      try {
        const obj = JSON.parse(texto) as {
          dadosLocais?: DadosLocais;
        } & Partial<DadosLocais>;
        const bruto = (obj.dadosLocais ?? obj) as DadosLocais;
        const dados = normalizar(bruto);
        if (!dados) {
          return { ok: false, mensagem: 'Arquivo de backup inválido.' };
        }

        dados.salvoEm = Date.now();
        set({ dados, temLocal: true, pendente: true });
        await servicoApi.localSalvar(dados);
        marcarPendente();
        await get().sincronizar(true);
        return { ok: true, mensagem: 'Backup importado com sucesso.' };
      } catch (e) {
        return { ok: false, mensagem: msgDeErro(e) };
      }
    },
  };
});

/** Expõe o estado atual fora de componentes (para uso em handlers). */
export function estadoLocal(): DadosLocais {
  return useStoreLocal.getState().dados;
}
