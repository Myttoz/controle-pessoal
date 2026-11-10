/**
 * Store de UI: navegação, mês, filtros (que vivem no cliente), toasts e modal.
 * Nenhuma requisição aqui — filtros são aplicados sobre o cache local.
 */
import { create } from 'zustand';
import type { LancamentoMensal, Registro, SiglaMes } from '@/types/api-types';
import { mesAtual } from '@/lib/meses';

export type Pagina =
  | 'dashboard'
  | 'lancamentos'
  | 'kanban'
  | 'pagamentos'
  | 'ganhos'
  | 'horasextras'
  | 'ferias'
  | 'manutencao'
  | 'anos'
  | 'lembretes'
  | 'sincronizacao';

export interface Filtros {
  categoria: string;
  tipo: string;
  forma: string;
  quem: string;
  /** yyyy-MM-dd */
  de: string;
  /** yyyy-MM-dd */
  ate: string;
}

export const FILTROS_VAZIOS: Filtros = {
  categoria: '',
  tipo: '',
  forma: '',
  quem: '',
  de: '',
  ate: '',
};

export type ModalLancamento =
  | { modo: 'novo' }
  | { modo: 'editar'; aba: string; registro: Registro<LancamentoMensal> };

export type DirecaoOrdem = 'asc' | 'desc';

/** Ordenação de coluna da tabela de Lançamentos (null = sem ordenação). */
export interface OrdemColuna {
  campo: string;
  direcao: DirecaoOrdem;
}

/** Filtros multi-seleção por coluna (estilo tabela dinâmica do Excel). */
export type FiltrosColunas = Record<string, string[]>;

export interface ToastUI {
  id: number;
  tipo: 'sucesso' | 'erro' | 'info';
  texto: string;
}

interface EstadoUI {
  pagina: Pagina;
  mes: SiglaMes;
  busca: string;
  filtros: Filtros;
  /** Ordenação da tabela de Lançamentos (null = ordem natural do mês). */
  ordemLancamentos: OrdemColuna | null;
  /** Seleção múltipla por coluna da tabela de Lançamentos (vazio = todos). */
  filtrosColunas: FiltrosColunas;
  abaExtras: 'ganhos' | 'gastos';
  modalLancamento: ModalLancamento | null;
  /** Contador para sinalizar "focar a busca" vindo dos atalhos globais. */
  focoBusca: number;
  toasts: ToastUI[];

  irPara(pagina: Pagina): void;
  setMes(mes: SiglaMes): void;
  setBusca(busca: string): void;
  setFiltro(campo: keyof Filtros, valor: string): void;
  limparFiltros(): void;
  /** Ciclo: sem ordenação → `inicial` → oposta → sem ordenação. */
  alternarOrdemLancamentos(campo: string, inicial?: DirecaoOrdem): void;
  alternarFiltroColuna(campo: string, valor: string): void;
  limparFiltroColuna(campo: string): void;
  setAbaExtras(aba: 'ganhos' | 'gastos'): void;
  abrirNovoLancamento(): void;
  abrirEditarLancamento(aba: string, registro: Registro<LancamentoMensal>): void;
  fecharModalLancamento(): void;
  solicitarFocoBusca(): void;
  toast(tipo: ToastUI['tipo'], texto: string): void;
  removerToast(id: number): void;
}

let proximoIdToast = 1;

export const useStoreUI = create<EstadoUI>((set, get) => ({
  pagina: 'dashboard',
  mes: mesAtual(),
  busca: '',
  filtros: { ...FILTROS_VAZIOS },
  ordemLancamentos: null,
  filtrosColunas: {},
  abaExtras: 'ganhos',
  modalLancamento: null,
  focoBusca: 0,
  toasts: [],

  irPara: (pagina) => set({ pagina }),
  setMes: (mes) => set({ mes }),
  setBusca: (busca) => set({ busca }),
  setFiltro: (campo, valor) => set({ filtros: { ...get().filtros, [campo]: valor } }),
  limparFiltros: () =>
    set({
      filtros: { ...FILTROS_VAZIOS },
      busca: '',
      ordemLancamentos: null,
      filtrosColunas: {},
    }),

  alternarOrdemLancamentos: (campo, inicial = 'asc') => {
    const atual = get().ordemLancamentos;
    if (!atual || atual.campo !== campo) {
      set({ ordemLancamentos: { campo, direcao: inicial } });
      return;
    }
    // ciclo: inicial → oposta → sem ordenação
    if (atual.direcao === inicial) {
      set({ ordemLancamentos: { campo, direcao: inicial === 'asc' ? 'desc' : 'asc' } });
    } else {
      set({ ordemLancamentos: null });
    }
  },
  alternarFiltroColuna: (campo, valor) => {
    const atual = get().filtrosColunas[campo] ?? [];
    const novo = atual.includes(valor)
      ? atual.filter((v) => v !== valor)
      : [...atual, valor];
    set({ filtrosColunas: { ...get().filtrosColunas, [campo]: novo } });
  },
  limparFiltroColuna: (campo) => {
    const resto: FiltrosColunas = {};
    for (const [chave, lista] of Object.entries(get().filtrosColunas)) {
      if (chave !== campo) resto[chave] = lista;
    }
    set({ filtrosColunas: resto });
  },

  setAbaExtras: (abaExtras) => set({ abaExtras }),

  abrirNovoLancamento: () => set({ modalLancamento: { modo: 'novo' } }),
  abrirEditarLancamento: (aba, registro) => set({ modalLancamento: { modo: 'editar', aba, registro } }),
  fecharModalLancamento: () => set({ modalLancamento: null }),

  solicitarFocoBusca: () => set({ focoBusca: get().focoBusca + 1 }),

  toast: (tipo, texto) => {
    const id = proximoIdToast++;
    set({ toasts: [...get().toasts, { id, tipo, texto }] });
    const duracao = tipo === 'erro' ? 8000 : 4000;
    setTimeout(() => get().removerToast(id), duracao);
  },
  removerToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
